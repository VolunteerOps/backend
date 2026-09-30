#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/00aeb0ad9f3abceee0f7215f1629960753b50d7b164f8ff6269e0177ab0eada7/contract';
import endContract from '../../snapshots/00aeb0ad9f3abceee0f7215f1629960753b50d7b164f8ff6269e0177ab0eada7/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/2b0d83f5d666f0d498f094b13fdb37188715d0af274db8526b271d90bdb77407/contract';
import startContract from '../../snapshots/2b0d83f5d666f0d498f094b13fdb37188715d0af274db8526b271d90bdb77407/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createIndex({
        schema: 'public',
        table: 'forecast_runs',
        index: 'forecast_run_expiry_idx',
        columns: ['expires_at'],
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'forecast_runs',
        policy: {
          naming: { kind: 'wire', prefix: 'forecast_retention_delete', hash: '4f220b2d' },
          tableName: 'forecast_runs',
          namespaceId: 'public',
          operation: 'delete',
          roles: [],
          using:
            "current_setting('vops.retention', true) = 'true' AND expires_at <= (clock_timestamp() AT TIME ZONE 'UTC')",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'forecast_runs',
        policy: {
          naming: { kind: 'wire', prefix: 'forecast_retention_read', hash: '9a5dff5a' },
          tableName: 'forecast_runs',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "current_setting('vops.retention', true) = 'true' AND expires_at <= (clock_timestamp() AT TIME ZONE 'UTC')",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'ingress_receipts',
        policy: {
          naming: { kind: 'wire', prefix: 'receipt_retention_delete', hash: '4f220b2d' },
          tableName: 'ingress_receipts',
          namespaceId: 'public',
          operation: 'delete',
          roles: [],
          using:
            "current_setting('vops.retention', true) = 'true' AND expires_at <= (clock_timestamp() AT TIME ZONE 'UTC')",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'ingress_receipts',
        policy: {
          naming: { kind: 'wire', prefix: 'receipt_retention_read', hash: '9a5dff5a' },
          tableName: 'ingress_receipts',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "current_setting('vops.retention', true) = 'true' AND expires_at <= (clock_timestamp() AT TIME ZONE 'UTC')",
          permissive: true,
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
