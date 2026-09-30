import type { PoolClient } from 'pg';
import type { VerifiedFirebaseIdentity } from '../../core/firebase.js';
import { ApiError } from '../../core/errors.js';
import { requireRecentMfa } from '../organizations/authorization.js';

/** Out-of-band, migration-role operation. There is deliberately no HTTP route. */
export async function bootstrapPlatformOwner(client: PoolClient, identity: VerifiedFirebaseIdentity, userId: number, reason: string) {
  requireRecentMfa(identity);
  await client.query('BEGIN');
  try {
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended('vops:platform-grants',0))`);
    const existing = await client.query('SELECT user_id FROM public.platform_grants LIMIT 1');
    if (existing.rowCount !== 0) throw ApiError.conflict('Owner bootstrap has already been used; use reviewed recovery', 'BOOTSTRAP_ALREADY_USED');
    const user = await client.query(`SELECT u.id FROM public.users u JOIN public.firebase_identities f ON f.user_id = u.id
      WHERE u.id = $1 AND u.is_active AND f.project_id = $2 AND f.uid = $3
        AND (f.revoked_before IS NULL OR f.revoked_before < (to_timestamp($4) AT TIME ZONE 'UTC')) FOR UPDATE OF u,f`,
    [userId, identity.projectId, identity.uid, identity.authTime]);
    if (user.rowCount !== 1) throw ApiError.forbidden('Reviewed numeric user and Firebase identity binding required', 'IDENTITY_BINDING_REQUIRED');
    await client.query('INSERT INTO public.platform_grants(user_id) VALUES ($1)', [userId]);
    await client.query(`INSERT INTO public.audit_logs(user_id,action,entity_type,entity_id,new_values)
      VALUES ($1,'PLATFORM_OWNER_BOOTSTRAPPED','User',$1,$2::jsonb)`, [userId, JSON.stringify({ reason })]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}

/** Explicit operator-approved migration mapping; email equality never grants ownership. */
export async function bindLegacyIdentity(client: PoolClient, identity: VerifiedFirebaseIdentity, userId: number, reason: string) {
  requireRecentMfa(identity);
  await client.query('BEGIN');
  try {
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [JSON.stringify({ projectId: identity.projectId, uid: identity.uid })]);
    const user = await client.query('SELECT id FROM public.users WHERE id = $1 AND is_active FOR UPDATE', [userId]);
    if (user.rowCount !== 1) throw ApiError.notFound('Active legacy user');
    const existing = await client.query(`SELECT user_id, project_id, uid FROM public.firebase_identities
      WHERE user_id = $1 OR (project_id = $2 AND uid = $3)`, [userId, identity.projectId, identity.uid]);
    if (existing.rows.length > 0) {
      if (existing.rows.length !== 1 || existing.rows[0].user_id !== userId || existing.rows[0].project_id !== identity.projectId || existing.rows[0].uid !== identity.uid) {
        throw ApiError.conflict('An immutable identity binding already exists', 'IDENTITY_CONFLICT');
      }
      await client.query('COMMIT'); return;
    }
    await client.query('INSERT INTO public.firebase_identities(project_id,uid,user_id) VALUES ($1,$2,$3)', [identity.projectId, identity.uid, userId]);
    await client.query('UPDATE public.refresh_tokens SET is_revoked = true WHERE user_id = $1', [userId]);
    await client.query(`INSERT INTO public.audit_logs(user_id,action,entity_type,entity_id,new_values)
      VALUES ($1,'LEGACY_IDENTITY_BOUND','User',$1,$2::jsonb)`, [userId, JSON.stringify({ reason })]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}
