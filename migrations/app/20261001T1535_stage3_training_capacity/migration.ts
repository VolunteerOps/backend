#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/6d00f9417e6f890944875849b1dac5ad1215ea821e8b88741f93f0459b04389a/contract';
import endContract from '../../snapshots/6d00f9417e6f890944875849b1dac5ad1215ea821e8b88741f93f0459b04389a/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/816338acf8a67abac1fa402e166abd65becef09faf987103123b56c527f1d0f0/contract';
import startContract from '../../snapshots/816338acf8a67abac1fa402e166abd65becef09faf987103123b56c527f1d0f0/contract.json' with { type: 'json' };
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
          naming: { kind: 'wire', prefix: 'operations_scope', hash: '85399603' },
          tableName: 'operation_records',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "organization_id = current_setting('vops.organization_id',true) AND region_id = current_setting('vops.region_id',true) AND (kind NOT IN ('APPLICATION','ASSIGNMENT','HOURS','SUPPORT','ENROLLMENT','CREDENTIAL','COURSE_ASSESSMENT') OR (kind IN ('COURSE_ASSESSMENT','ENROLLMENT') AND current_setting('vops.training',true)='true') OR owner_id = nullif(current_setting('vops.user_id',true),'')::integer OR EXISTS(SELECT 1 FROM public.organization_memberships m WHERE m.organization_id=operation_records.organization_id AND m.user_id=nullif(current_setting('vops.user_id',true),'')::integer AND m.status='ACTIVE' AND m.role IN ('ORG_ADMIN','COORDINATOR')))",
          permissive: true,
        },
      }),
      this.dropRlsPolicy({
        schema: 'public',
        table: 'operation_records',
        policy: 'operations_scope_d804864b',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
