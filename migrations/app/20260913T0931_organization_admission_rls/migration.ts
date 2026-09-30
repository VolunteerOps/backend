#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/2e818e74020d477243a5385c079065efcc7cacc4348e0183656cf6e7f2de9100/contract';
import endContract from '../../snapshots/2e818e74020d477243a5385c079065efcc7cacc4348e0183656cf6e7f2de9100/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/96cbcacab5d2480c05b1be6a0ca8a89a552be113b5d25c2967594248cdb9e1a7/contract';
import startContract from '../../snapshots/96cbcacab5d2480c05b1be6a0ca8a89a552be113b5d25c2967594248cdb9e1a7/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'organization_audit',
        columns: [
          col('action', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('actor_user_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('metadata', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('organization_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reason', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'organization_invitations',
        columns: [
          col('accepted_at', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('accepted_by_user_id', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('expires_at', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('issuer_user_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('organization_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('recipient_email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('region_ids', 'text[]', {
            notNull: true,
            default: lit([]),
            codecRef: { codecId: 'pg/text@1', many: true },
          }),
          col('revoked_at', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('role', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('token_hash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'invitation_role_f8fb0bd8',
            "role IN ('ORG_ADMIN', 'COORDINATOR', 'TEAM_LEAD', 'VOLUNTEER')",
          ),
          checkExpression(
            'organization_invitations_region_ids_elem_not_null_0defcd39',
            'array_position("region_ids", NULL) IS NULL',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'organization_memberships',
        columns: [
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organization_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('region_ids', 'text[]', {
            notNull: true,
            default: lit([]),
            codecRef: { codecId: 'pg/text@1', many: true },
          }),
          col('role', 'text', {
            notNull: true,
            default: lit('VOLUNTEER'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('user_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('version', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'membership_role_f8fb0bd8',
            "role IN ('ORG_ADMIN', 'COORDINATOR', 'TEAM_LEAD', 'VOLUNTEER')",
          ),
          checkExpression(
            'membership_status_36df456f',
            "status IN ('ACTIVE', 'SUSPENDED', 'REMOVED')",
          ),
          checkExpression(
            'organization_memberships_region_ids_elem_not_null_0defcd39',
            'array_position("region_ids", NULL) IS NULL',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'organizations',
        columns: [
          col('allowed_providers', 'text[]', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1', many: true },
          }),
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('display_name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('enrollment_ready', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('require_mfa', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('slug', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PROVISIONED'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updated_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('verification_evidence', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('version', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'organization_status_9bfaa026',
            "status IN ('PROVISIONED', 'ACTIVE', 'SUSPENDED', 'OFFBOARDING', 'ARCHIVED')",
          ),
          checkExpression('organization_version_341aaa74', 'version > 0'),
          checkExpression(
            'organizations_allowed_providers_elem_not_null_39804e80',
            'array_position("allowed_providers", NULL) IS NULL',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'platform_grants',
        columns: [
          col('active', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('role', 'text', {
            notNull: true,
            default: lit('TECH_ADMIN'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('user_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['user_id']),
          checkExpression('platform_grant_role_c42ac32a', "role = 'TECH_ADMIN'"),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'organization_invitations',
        constraint: 'organization_invitations_token_hash_key',
        columns: ['token_hash'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'organization_memberships',
        constraint: 'organization_memberships_organization_id_user_id_key',
        columns: ['organization_id', 'user_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'organizations',
        constraint: 'organizations_slug_key',
        columns: ['slug'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'organization_audit',
        index: 'organization_audit_organization_id_created_at_idx_86b4d119',
        columns: ['organization_id', 'created_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'organization_invitations',
        index: 'organization_invitations_organization_id_idx_1a5cd3f5',
        columns: ['organization_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'organization_memberships',
        index: 'organization_memberships_user_id_idx_6c952402',
        columns: ['user_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'organization_audit',
        foreignKey: {
          name: 'organization_audit_organization_id_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'organization_audit',
        foreignKey: {
          name: 'organization_audit_actor_user_id_fkey',
          columns: ['actor_user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'organization_invitations',
        foreignKey: {
          name: 'organization_invitations_organization_id_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'organization_invitations',
        foreignKey: {
          name: 'organization_invitations_issuer_user_id_fkey',
          columns: ['issuer_user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'organization_memberships',
        foreignKey: {
          name: 'organization_memberships_organization_id_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'organization_memberships',
        foreignKey: {
          name: 'organization_memberships_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'platform_grants',
        foreignKey: {
          name: 'platform_grants_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'organization_audit' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'organization_invitations' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'organization_memberships' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'organizations' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'platform_grants' }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'organization_audit',
        policy: {
          naming: { kind: 'wire', prefix: 'audit_append', hash: '11366b27' },
          tableName: 'organization_audit',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck:
            "actor_user_id = nullif(current_setting('vops.user_id', true), '')::integer AND ((current_setting('vops.platform', true) = 'true' AND EXISTS (SELECT 1 FROM public.platform_grants g WHERE g.user_id = nullif(current_setting('vops.user_id', true), '')::integer AND g.active AND g.role = 'TECH_ADMIN')) OR organization_id = nullif(current_setting('vops.organization_id', true), ''))",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'organization_audit',
        policy: {
          naming: { kind: 'wire', prefix: 'audit_read', hash: '52360ea0' },
          tableName: 'organization_audit',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "(current_setting('vops.platform', true) = 'true' AND EXISTS (SELECT 1 FROM public.platform_grants g WHERE g.user_id = nullif(current_setting('vops.user_id', true), '')::integer AND g.active AND g.role = 'TECH_ADMIN')) OR (organization_id = nullif(current_setting('vops.organization_id', true), '') AND current_setting('vops.roster', true) = 'true')",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'organization_invitations',
        policy: {
          naming: { kind: 'wire', prefix: 'invitation_consume', hash: 'a24f5380' },
          tableName: 'organization_invitations',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using:
            "(current_setting('vops.platform', true) = 'true' AND EXISTS (SELECT 1 FROM public.platform_grants g WHERE g.user_id = nullif(current_setting('vops.user_id', true), '')::integer AND g.active AND g.role = 'TECH_ADMIN')) OR (organization_id = nullif(current_setting('vops.organization_id', true), '') AND current_setting('vops.roster', true) = 'true') OR (token_hash = nullif(current_setting('vops.invitation_hash', true), '') AND recipient_email = current_setting('vops.email', true))",
          withCheck:
            "(current_setting('vops.platform', true) = 'true' AND EXISTS (SELECT 1 FROM public.platform_grants g WHERE g.user_id = nullif(current_setting('vops.user_id', true), '')::integer AND g.active AND g.role = 'TECH_ADMIN')) OR (organization_id = nullif(current_setting('vops.organization_id', true), '') AND current_setting('vops.roster', true) = 'true') OR (token_hash = nullif(current_setting('vops.invitation_hash', true), '') AND recipient_email = current_setting('vops.email', true))",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'organization_invitations',
        policy: {
          naming: { kind: 'wire', prefix: 'invitation_issue', hash: '6732cfa1' },
          tableName: 'organization_invitations',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck:
            "(current_setting('vops.platform', true) = 'true' AND EXISTS (SELECT 1 FROM public.platform_grants g WHERE g.user_id = nullif(current_setting('vops.user_id', true), '')::integer AND g.active AND g.role = 'TECH_ADMIN')) OR (organization_id = nullif(current_setting('vops.organization_id', true), '') AND current_setting('vops.roster', true) = 'true')",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'organization_invitations',
        policy: {
          naming: { kind: 'wire', prefix: 'invitation_read', hash: '061c49a5' },
          tableName: 'organization_invitations',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "(current_setting('vops.platform', true) = 'true' AND EXISTS (SELECT 1 FROM public.platform_grants g WHERE g.user_id = nullif(current_setting('vops.user_id', true), '')::integer AND g.active AND g.role = 'TECH_ADMIN')) OR (organization_id = nullif(current_setting('vops.organization_id', true), '') AND current_setting('vops.roster', true) = 'true') OR (token_hash = nullif(current_setting('vops.invitation_hash', true), '') AND recipient_email = current_setting('vops.email', true))",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'organization_memberships',
        policy: {
          naming: { kind: 'wire', prefix: 'membership_admit', hash: '981c377a' },
          tableName: 'organization_memberships',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND user_id = nullif(current_setting('vops.user_id', true), '')::integer AND current_setting('vops.admission', true) = 'true'",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'organization_memberships',
        policy: {
          naming: { kind: 'wire', prefix: 'membership_manage', hash: '7585ee31' },
          tableName: 'organization_memberships',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND current_setting('vops.membership_write', true) = 'true'",
          withCheck:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND current_setting('vops.membership_write', true) = 'true'",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'organization_memberships',
        policy: {
          naming: { kind: 'wire', prefix: 'membership_read', hash: '4cbcb747' },
          tableName: 'organization_memberships',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "user_id = nullif(current_setting('vops.user_id', true), '')::integer OR (organization_id = nullif(current_setting('vops.organization_id', true), '') AND current_setting('vops.roster', true) = 'true')",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'organizations',
        policy: {
          naming: { kind: 'wire', prefix: 'organization_lifecycle', hash: '85d500ea' },
          tableName: 'organizations',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using:
            "current_setting('vops.platform', true) = 'true' AND EXISTS (SELECT 1 FROM public.platform_grants g WHERE g.user_id = nullif(current_setting('vops.user_id', true), '')::integer AND g.active AND g.role = 'TECH_ADMIN')",
          withCheck:
            "current_setting('vops.platform', true) = 'true' AND EXISTS (SELECT 1 FROM public.platform_grants g WHERE g.user_id = nullif(current_setting('vops.user_id', true), '')::integer AND g.active AND g.role = 'TECH_ADMIN')",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'organizations',
        policy: {
          naming: { kind: 'wire', prefix: 'organization_provision', hash: '5f87e4be' },
          tableName: 'organizations',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck:
            "current_setting('vops.platform', true) = 'true' AND EXISTS (SELECT 1 FROM public.platform_grants g WHERE g.user_id = nullif(current_setting('vops.user_id', true), '')::integer AND g.active AND g.role = 'TECH_ADMIN')",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'organizations',
        policy: {
          naming: { kind: 'wire', prefix: 'organization_read', hash: '29631cf2' },
          tableName: 'organizations',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "(current_setting('vops.platform', true) = 'true' AND EXISTS (SELECT 1 FROM public.platform_grants g WHERE g.user_id = nullif(current_setting('vops.user_id', true), '')::integer AND g.active AND g.role = 'TECH_ADMIN')) OR id = nullif(current_setting('vops.organization_id', true), '') OR EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.organization_id = organizations.id AND m.user_id = nullif(current_setting('vops.user_id', true), '')::integer)",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'platform_grants',
        policy: {
          naming: { kind: 'wire', prefix: 'platform_self', hash: '95582c40' },
          tableName: 'platform_grants',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using: "user_id = nullif(current_setting('vops.user_id', true), '')::integer",
          permissive: true,
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
