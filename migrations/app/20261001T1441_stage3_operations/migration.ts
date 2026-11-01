#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/24fd3be1dfd8b3d9c19cb4d6e3c57198ea998f5041d3fa6e50601ea539f85210/contract';
import startContract from '../../snapshots/24fd3be1dfd8b3d9c19cb4d6e3c57198ea998f5041d3fa6e50601ea539f85210/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/787f4659367360d2708bbad749edac72102f408ee1c226f34a3d33f30786f0d3/contract';
import endContract from '../../snapshots/787f4659367360d2708bbad749edac72102f408ee1c226f34a3d33f30786f0d3/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'operation_receipts',
        columns: [
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('fingerprint', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('key', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organization_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('region_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('result', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('user_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'operation_records',
        columns: [
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('kind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organization_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('owner_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('parent_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('payload', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('region_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sequence', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('updated_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('version', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'operation_receipts',
        constraint: 'operation_receipts_user_id_key_key',
        columns: ['user_id', 'key'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'operation_records',
        constraint: 'operation_records_sequence_key',
        columns: ['sequence'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'operation_records',
        index: 'ops_parent_kind',
        columns: ['organization_id', 'parent_id', 'kind'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'operation_records',
        index: 'ops_scope_sequence',
        columns: ['organization_id', 'region_id', 'kind', 'sequence'],
      }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'operation_receipts' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'operation_records' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
