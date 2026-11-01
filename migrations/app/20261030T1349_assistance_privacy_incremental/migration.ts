#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/1dc2b31d4b5de04458ea41aa2f3718a54da7f090bfe057f2bbd3d54ebff7dfa7/contract';
import startContract from '../../snapshots/1dc2b31d4b5de04458ea41aa2f3718a54da7f090bfe057f2bbd3d54ebff7dfa7/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/83008733c091b8a0452428b97e02ad4f482b39f0a30edb8889715fe0d290ec2e/contract';
import endContract from '../../snapshots/83008733c091b8a0452428b97e02ad4f482b39f0a30edb8889715fe0d290ec2e/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createRlsPolicy({
        schema: 'public',
        table: 'operation_records',
        policy: {
          naming: { kind: 'wire', prefix: 'assistance_private', hash: 'd841f1b3' },
          tableName: 'operation_records',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "kind NOT IN ('ASSISTANCE_CASE','ASSISTANCE_EVENT') OR owner_id=nullif(current_setting('vops.user_id',true),'')::integer OR EXISTS(SELECT 1 FROM public.organization_memberships m WHERE m.organization_id=operation_records.organization_id AND m.user_id=nullif(current_setting('vops.user_id',true),'')::integer AND m.status='ACTIVE' AND m.role IN ('ORG_ADMIN','COORDINATOR'))",
          permissive: false,
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
