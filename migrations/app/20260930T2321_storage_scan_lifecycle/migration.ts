#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/317429c4c267e61610b01e1c988b7c86d49fb8317c1c058ffc7ba3bc748ef2a3/contract';
import endContract from '../../snapshots/317429c4c267e61610b01e1c988b7c86d49fb8317c1c058ffc7ba3bc748ef2a3/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/990961d70f672d4263adfbc296869480eebb8ecbd30e9a70078c0c4012adf8aa/contract';
import startContract from '../../snapshots/990961d70f672d4263adfbc296869480eebb8ecbd30e9a70078c0c4012adf8aa/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'stored_objects',
        constraint: 'stored_object_completion_a37fde25',
      }),
      this.dropCheckConstraint({
        schema: 'public',
        table: 'stored_objects',
        constraint: 'stored_object_state_a37b3d27',
      }),
      this.addColumn({
        schema: 'public',
        table: 'stored_objects',
        column: col('scan_code', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'stored_objects',
        column: col('scanned_at', 'timestamp(3)', {
          codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
        }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'stored_objects',
        constraint: 'stored_object_completion_f65889f3',
        expression:
          "(state IN ('PENDING', 'DELETED')) OR (state IN ('READY', 'QUARANTINED', 'CLEAN', 'REJECTED') AND completed_at IS NOT NULL AND etag IS NOT NULL)",
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'stored_objects',
        constraint: 'stored_object_scan_c005fb48',
        expression: "state != 'CLEAN' OR (scanned_at IS NOT NULL AND scan_code = 'CLEAN')",
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'stored_objects',
        constraint: 'stored_object_state_ace896ac',
        expression: "state IN ('PENDING', 'READY', 'QUARANTINED', 'CLEAN', 'REJECTED', 'DELETED')",
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'stored_objects',
        policy: {
          naming: { kind: 'wire', prefix: 'stored_object_complete', hash: 'c00bfc04' },
          tableName: 'stored_objects',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND region_id = nullif(current_setting('vops.region_id', true), '') AND uploader_user_id = nullif(current_setting('vops.user_id', true), '')::integer AND state = 'PENDING'",
          withCheck:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND region_id = nullif(current_setting('vops.region_id', true), '') AND uploader_user_id = nullif(current_setting('vops.user_id', true), '')::integer AND state = 'QUARANTINED'",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'stored_objects',
        policy: {
          naming: { kind: 'wire', prefix: 'stored_object_scan_read', hash: '6f4a3851' },
          tableName: 'stored_objects',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "current_user = 'sentinel_scanner' AND state IN ('QUARANTINED', 'READY', 'CLEAN', 'REJECTED', 'PENDING', 'DELETED')",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'stored_objects',
        policy: {
          naming: { kind: 'wire', prefix: 'stored_object_scan_update', hash: 'cb1d5a00' },
          tableName: 'stored_objects',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using:
            "current_user = 'sentinel_scanner' AND state IN ('QUARANTINED', 'READY', 'PENDING', 'REJECTED')",
          withCheck:
            "current_user = 'sentinel_scanner' AND state IN ('CLEAN', 'REJECTED', 'DELETED')",
          permissive: true,
        },
      }),
      this.dropRlsPolicy({
        schema: 'public',
        table: 'stored_objects',
        policy: 'stored_object_complete_a84ca85a',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
