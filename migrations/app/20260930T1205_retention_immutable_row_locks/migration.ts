#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/00aeb0ad9f3abceee0f7215f1629960753b50d7b164f8ff6269e0177ab0eada7/contract';
import startContract from '../../snapshots/00aeb0ad9f3abceee0f7215f1629960753b50d7b164f8ff6269e0177ab0eada7/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/7f31e09af996268dfba89c50a537d7876f490d9ba042aec960791ff55ff28b21/contract';
import endContract from '../../snapshots/7f31e09af996268dfba89c50a537d7876f490d9ba042aec960791ff55ff28b21/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createRlsPolicy({
        schema: 'public',
        table: 'forecast_runs',
        policy: {
          naming: { kind: 'wire', prefix: 'forecast_retention_lock', hash: 'be6f8360' },
          tableName: 'forecast_runs',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using:
            "current_setting('vops.retention', true) = 'true' AND expires_at <= (clock_timestamp() AT TIME ZONE 'UTC')",
          withCheck: 'false',
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'ingress_receipts',
        policy: {
          naming: { kind: 'wire', prefix: 'receipt_retention_lock', hash: 'be6f8360' },
          tableName: 'ingress_receipts',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using:
            "current_setting('vops.retention', true) = 'true' AND expires_at <= (clock_timestamp() AT TIME ZONE 'UTC')",
          withCheck: 'false',
          permissive: true,
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
