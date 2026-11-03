#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/1ff7d7e89ec9085065fdc50c8d77ccb450566d996322db585fc7c5d457105f36/contract';
import endContract from '../../snapshots/1ff7d7e89ec9085065fdc50c8d77ccb450566d996322db585fc7c5d457105f36/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/c5b6078f3f258d50f0fd9100bdd2d7e5feed57d6c6962c82cde59c20dc4c371d/contract';
import startContract from '../../snapshots/c5b6078f3f258d50f0fd9100bdd2d7e5feed57d6c6962c82cde59c20dc4c371d/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'user_drafts',
        columns: [
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('key', 'character varying(300)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 300 } },
          }),
          col('payload', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('updated_at', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('user_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('version', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [primaryKey(['user_id', 'key'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'user_drafts',
        index: 'user_drafts_user_updated_idx',
        columns: ['user_id', 'updated_at'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'user_drafts',
        foreignKey: {
          name: 'user_drafts_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'user_drafts' }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'user_drafts',
        policy: {
          naming: { kind: 'wire', prefix: 'user_drafts_create', hash: '32894381' },
          tableName: 'user_drafts',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck: "user_id=nullif(current_setting('vops.user_id',true),'')::integer",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'user_drafts',
        policy: {
          naming: { kind: 'wire', prefix: 'user_drafts_delete', hash: '39b81a50' },
          tableName: 'user_drafts',
          namespaceId: 'public',
          operation: 'delete',
          roles: [],
          using: "user_id=nullif(current_setting('vops.user_id',true),'')::integer",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'user_drafts',
        policy: {
          naming: { kind: 'wire', prefix: 'user_drafts_read', hash: 'eb9ee7c4' },
          tableName: 'user_drafts',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using: "user_id=nullif(current_setting('vops.user_id',true),'')::integer",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'user_drafts',
        policy: {
          naming: { kind: 'wire', prefix: 'user_drafts_update', hash: '31b62e0c' },
          tableName: 'user_drafts',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using: "user_id=nullif(current_setting('vops.user_id',true),'')::integer",
          withCheck: "user_id=nullif(current_setting('vops.user_id',true),'')::integer",
          permissive: true,
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
