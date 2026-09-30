#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/2b0d83f5d666f0d498f094b13fdb37188715d0af274db8526b271d90bdb77407/contract';
import endContract from '../../snapshots/2b0d83f5d666f0d498f094b13fdb37188715d0af274db8526b271d90bdb77407/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/f8aca1827288d6f8c75ca0db297b8a08f75250d11e63908d261744176cc47738/contract';
import startContract from '../../snapshots/f8aca1827288d6f8c75ca0db297b8a08f75250d11e63908d261744176cc47738/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'durable_jobs',
        column: col('last_claimed_at', 'timestamp(3)', {
          codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'durable_jobs',
        column: col('organization_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'durable_jobs',
        column: col('priority', 'int4', {
          notNull: true,
          default: lit(1),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'durable_jobs',
        index: 'durable_jobs_tenant_fairness_idx',
        columns: ['queue', 'organization_id', 'last_claimed_at'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
