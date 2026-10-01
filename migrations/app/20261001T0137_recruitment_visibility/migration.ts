#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/041cae8d47a4c7c1ab771e1f4da766e47139da8e3a652736111b2030e6e73c49/contract';
import endContract from '../../snapshots/041cae8d47a4c7c1ab771e1f4da766e47139da8e3a652736111b2030e6e73c49/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/adb4ba9ca5a97be295d907a07363004f8e89bfdc657d8f21611133897fa1df5f/contract';
import startContract from '../../snapshots/adb4ba9ca5a97be295d907a07363004f8e89bfdc657d8f21611133897fa1df5f/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'organizations',
        column: col('recruitment_open', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'organizations',
        policy: {
          naming: { kind: 'wire', prefix: 'organization_read', hash: '9ed60339' },
          tableName: 'organizations',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "(current_setting('vops.public_workspaces', true) = 'true' AND recruitment_open AND status = 'ACTIVE' AND enrollment_ready) OR (current_setting('vops.platform', true) = 'true' AND EXISTS (SELECT 1 FROM public.platform_grants g WHERE g.user_id = nullif(current_setting('vops.user_id', true), '')::integer AND g.active AND g.role = 'TECH_ADMIN')) OR id = nullif(current_setting('vops.organization_id', true), '') OR EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.organization_id = organizations.id AND m.user_id = nullif(current_setting('vops.user_id', true), '')::integer)",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'organizations',
        policy: {
          naming: { kind: 'wire', prefix: 'organization_recruitment', hash: 'a1cab5f3' },
          tableName: 'organizations',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using:
            "id = current_setting('vops.organization_id', true) AND current_setting('vops.organization_settings', true) = 'true'",
          withCheck:
            "id = current_setting('vops.organization_id', true) AND current_setting('vops.organization_settings', true) = 'true'",
          permissive: true,
        },
      }),
      this.dropRlsPolicy({
        schema: 'public',
        table: 'organizations',
        policy: 'organization_read_29631cf2',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
