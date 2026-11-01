#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/5c4b6aadc3db74c9fef4369f5c974226d9c3a957ee08a4932d325b3dd74340a4/contract';
import startContract from '../../snapshots/5c4b6aadc3db74c9fef4369f5c974226d9c3a957ee08a4932d325b3dd74340a4/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/dc330cdcc179891ac93a3c0056e4d73bfae920406bd77bbb5f5fca040e6c44f1/contract';
import endContract from '../../snapshots/dc330cdcc179891ac93a3c0056e4d73bfae920406bd77bbb5f5fca040e6c44f1/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'pro_sponsorships',
        columns: [
          col('active', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organization_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sponsor_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('user_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
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
        table: 'pro_sponsorships',
        constraint: 'pro_sponsorship_recipient',
        columns: ['organization_id', 'user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'pro_sponsorships',
        index: 'pro_sponsor_active',
        columns: ['sponsor_id', 'active'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'pro_sponsorships',
        foreignKey: {
          name: 'pro_sponsorships_organization_id_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'pro_sponsorships',
        foreignKey: {
          name: 'pro_sponsorships_sponsor_id_fkey',
          columns: ['sponsor_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'pro_sponsorships',
        foreignKey: {
          name: 'pro_sponsorships_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'pro_sponsorships' }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'pro_sponsorships',
        policy: {
          naming: { kind: 'wire', prefix: 'pro_sponsorship_create', hash: 'a7128f45' },
          tableName: 'pro_sponsorships',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck:
            "sponsor_id=nullif(current_setting('vops.user_id',true),'')::integer AND organization_id=current_setting('vops.organization_id',true) AND current_setting('vops.roster',true)='true'",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'pro_sponsorships',
        policy: {
          naming: { kind: 'wire', prefix: 'pro_sponsorship_manage', hash: '7f85aec2' },
          tableName: 'pro_sponsorships',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using:
            "sponsor_id=nullif(current_setting('vops.user_id',true),'')::integer AND organization_id=current_setting('vops.organization_id',true) AND current_setting('vops.roster',true)='true'",
          withCheck:
            "sponsor_id=nullif(current_setting('vops.user_id',true),'')::integer AND organization_id=current_setting('vops.organization_id',true)",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'pro_sponsorships',
        policy: {
          naming: { kind: 'wire', prefix: 'pro_sponsorship_read', hash: '32edc8d1' },
          tableName: 'pro_sponsorships',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "sponsor_id=nullif(current_setting('vops.user_id',true),'')::integer OR user_id=nullif(current_setting('vops.user_id',true),'')::integer",
          permissive: true,
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
