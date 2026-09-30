#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/7d59308894293d7e139b05cb4f18e818da4aa3c6fbf9f6a3692a17430c0089e5/contract';
import startContract from '../../snapshots/7d59308894293d7e139b05cb4f18e818da4aa3c6fbf9f6a3692a17430c0089e5/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/96cbcacab5d2480c05b1be6a0ca8a89a552be113b5d25c2967594248cdb9e1a7/contract';
import endContract from '../../snapshots/96cbcacab5d2480c05b1be6a0ca8a89a552be113b5d25c2967594248cdb9e1a7/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'durable_jobs',
        columns: [
          col('attempts', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('available_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('business_key', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('completed_at', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('deadline', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('fence', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('kind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('last_error', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('lease_owner', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('lease_until', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('max_attempts', 'int4', {
            notNull: true,
            default: lit(8),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('payload', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('queue', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('state', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'durable_jobs',
        constraint: 'durable_jobs_business_key_key',
        columns: ['business_key'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'durable_jobs',
        index: 'durable_jobs_claim_idx',
        columns: ['queue', 'state', 'available_at'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
