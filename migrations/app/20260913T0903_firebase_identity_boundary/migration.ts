#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/46d8f4daada32a8ad350a5904b9e8adc549a652b142707850575d37137d36ff5/contract';
import startContract from '../../snapshots/46d8f4daada32a8ad350a5904b9e8adc549a652b142707850575d37137d36ff5/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/7d59308894293d7e139b05cb4f18e818da4aa3c6fbf9f6a3692a17430c0089e5/contract';
import endContract from '../../snapshots/7d59308894293d7e139b05cb4f18e818da4aa3c6fbf9f6a3692a17430c0089e5/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'firebase_identities',
        columns: [
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('project_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('revoked_before', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('uid', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('user_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.dropNotNull({ schema: 'public', table: 'users', column: 'password_hash' }),
      this.addUnique({
        schema: 'public',
        table: 'firebase_identities',
        constraint: 'firebase_identities_user_id_key',
        columns: ['user_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'firebase_identities',
        constraint: 'firebase_identities_project_id_uid_key',
        columns: ['project_id', 'uid'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'firebase_identities',
        foreignKey: {
          name: 'firebase_identities_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
