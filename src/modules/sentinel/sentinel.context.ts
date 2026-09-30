import { ApiError } from '../../core/errors.js';
import { withActor, requireOrganization, type Actor, type TenantTransaction } from '../organizations/context.js';

export async function withRegion<T>(actor: Actor, organizationId: string, regionId: string,
  write: boolean, action: (tx: TenantTransaction) => Promise<T>) {
  return withActor(actor, async tx => {
    const { member, role } = await requireOrganization(tx, actor, organizationId, 'organization.read');
    if (member.regionIds.length && !member.regionIds.includes(regionId)) throw ApiError.forbidden('Region is outside your membership scope', 'SCOPE_REQUIRED');
    if (write && !['ORG_ADMIN', 'COORDINATOR'].includes(role)) throw ApiError.forbidden('Forecast refresh requires coordinator access', 'CAPABILITY_REQUIRED');
    const region = await tx.organizationUnit.findFirst({ where: { id: regionId, organizationId, active: true } });
    if (!region) throw ApiError.notFound('Region');
    await tx.$queryRaw`SELECT set_config('vops.region_id', ${regionId}, true),
      set_config('vops.all_regions', '', true), set_config('vops.operations', ${write ? 'true' : ''}, true)`;
    return action(tx);
  });
}
