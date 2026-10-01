#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/baa046a11b2e2ece7a32b8254a5dcde8fd7c30fb09ac92cd7e1cb06634e8431d/contract';
import startContract from '../../snapshots/baa046a11b2e2ece7a32b8254a5dcde8fd7c30fb09ac92cd7e1cb06634e8431d/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/c843f4230dd60338ed8e0a86d01d45ebb6afdc04d4623049e38d1d4ea8aeec63/contract';
import endContract from '../../snapshots/c843f4230dd60338ed8e0a86d01d45ebb6afdc04d4623049e38d1d4ea8aeec63/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createRlsPolicy({
        schema: 'public',
        table: 'organizations',
        policy: {
          naming: { kind: 'wire', prefix: 'organization_read', hash: '60a464d6' },
          tableName: 'organizations',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "EXISTS (SELECT 1 FROM public.organization_invitations i WHERE i.organization_id = organizations.id AND i.recipient_email = current_setting('vops.email', true) AND i.revoked_at IS NULL AND i.expires_at > now()) OR (current_setting('vops.public_workspaces', true) = 'true' AND recruitment_open AND status = 'ACTIVE' AND enrollment_ready) OR (current_setting('vops.platform', true) = 'true' AND EXISTS (SELECT 1 FROM public.platform_grants g WHERE g.user_id = nullif(current_setting('vops.user_id', true), '')::integer AND g.active AND g.role = 'TECH_ADMIN')) OR id = nullif(current_setting('vops.organization_id', true), '') OR EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.organization_id = organizations.id AND m.user_id = nullif(current_setting('vops.user_id', true), '')::integer)",
          permissive: true,
        },
      }),
      this.dropRlsPolicy({
        schema: 'public',
        table: 'organizations',
        policy: 'organization_read_9ed60339',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
