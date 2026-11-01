#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/37664ea1c77704cc73364a56a8bfafe27a55732848e19f55d6f7b6cc22ac90ff/contract';
import endContract from '../../snapshots/37664ea1c77704cc73364a56a8bfafe27a55732848e19f55d6f7b6cc22ac90ff/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/6d00f9417e6f890944875849b1dac5ad1215ea821e8b88741f93f0459b04389a/contract';
import startContract from '../../snapshots/6d00f9417e6f890944875849b1dac5ad1215ea821e8b88741f93f0459b04389a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'usage_ledger',
        columns: [
          col('bucket', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('finalized_at', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('fingerprint', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('metadata', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('period', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('request_key', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('state', 'text', {
            notNull: true,
            default: lit('RESERVED'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('units', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('user_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'usage_ledger',
        constraint: 'usage_request_key',
        columns: ['user_id', 'request_key'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'usage_ledger',
        index: 'usage_personal_bucket',
        columns: ['user_id', 'bucket', 'period', 'state'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'usage_ledger',
        foreignKey: {
          name: 'usage_ledger_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'usage_ledger' }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'usage_ledger',
        policy: {
          naming: { kind: 'wire', prefix: 'usage_owner_read', hash: 'eb9ee7c4' },
          tableName: 'usage_ledger',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using: "user_id=nullif(current_setting('vops.user_id',true),'')::integer",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'usage_ledger',
        policy: {
          naming: { kind: 'wire', prefix: 'usage_server_finalize', hash: 'fe0b29dd' },
          tableName: 'usage_ledger',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using:
            "user_id=nullif(current_setting('vops.user_id',true),'')::integer AND current_setting('vops.usage',true)='true'",
          withCheck: "user_id=nullif(current_setting('vops.user_id',true),'')::integer",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'usage_ledger',
        policy: {
          naming: { kind: 'wire', prefix: 'usage_server_reserve', hash: '444cf8b5' },
          tableName: 'usage_ledger',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck:
            "user_id=nullif(current_setting('vops.user_id',true),'')::integer AND current_setting('vops.usage',true)='true'",
          permissive: true,
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
