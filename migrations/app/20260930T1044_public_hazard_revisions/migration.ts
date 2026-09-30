#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/4d42caf375175aa8be08039cca054abe0469a5d505d3d6e833a11547f4c47431/contract';
import startContract from '../../snapshots/4d42caf375175aa8be08039cca054abe0469a5d505d3d6e833a11547f4c47431/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/f8aca1827288d6f8c75ca0db297b8a08f75250d11e63908d261744176cc47738/contract';
import endContract from '../../snapshots/f8aca1827288d6f8c75ca0db297b8a08f75250d11e63908d261744176cc47738/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'hazard_revisions',
        columns: [
          col('depth_km', 'numeric(8,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 8, scale: 2 } },
          }),
          col('external_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('latitude', 'numeric(10,7)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 7 } },
          }),
          col('longitude', 'numeric(10,7)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 7 } },
          }),
          col('magnitude', 'numeric(5,2)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 5, scale: 2 } },
          }),
          col('observed_at', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('received_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('revision_at', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('source', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('source_url', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'hazard_revisions',
        index: 'hazard_revision_source_idx',
        columns: ['source', 'external_id', 'revision_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'hazard_revisions',
        index: 'hazard_revision_time_idx',
        columns: ['observed_at'],
      }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'hazard_revisions' }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'hazard_revisions',
        policy: {
          naming: { kind: 'wire', prefix: 'hazard_provider_append', hash: '04809744' },
          tableName: 'hazard_revisions',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck: "current_setting('vops.provider_ingest', true) = 'USGS' AND source = 'USGS'",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'hazard_revisions',
        policy: {
          naming: { kind: 'wire', prefix: 'hazard_public_read', hash: 'dbc82c49' },
          tableName: 'hazard_revisions',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using: 'true',
          permissive: true,
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
