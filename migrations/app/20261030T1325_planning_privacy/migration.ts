#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/1dc2b31d4b5de04458ea41aa2f3718a54da7f090bfe057f2bbd3d54ebff7dfa7/contract';
import endContract from '../../snapshots/1dc2b31d4b5de04458ea41aa2f3718a54da7f090bfe057f2bbd3d54ebff7dfa7/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/37664ea1c77704cc73364a56a8bfafe27a55732848e19f55d6f7b6cc22ac90ff/contract';
import startContract from '../../snapshots/37664ea1c77704cc73364a56a8bfafe27a55732848e19f55d6f7b6cc22ac90ff/contract.json' with { type: 'json' };
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
          naming: { kind: 'wire', prefix: 'planning_private', hash: '4b888090' },
          tableName: 'operation_records',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "kind NOT IN ('RESOURCE_PLAN','WEATHER_ANALYSIS') OR EXISTS(SELECT 1 FROM public.organization_memberships m WHERE m.organization_id=operation_records.organization_id AND m.user_id=nullif(current_setting('vops.user_id',true),'')::integer AND m.status='ACTIVE' AND m.role IN ('ORG_ADMIN','COORDINATOR'))",
          permissive: false,
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
