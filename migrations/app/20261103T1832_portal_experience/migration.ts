#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/71810e86fd033f4327c1d7cc0ec45826c8994a030015b5ed470b968b58b4b3d3/contract';
import endContract from '../../snapshots/71810e86fd033f4327c1d7cc0ec45826c8994a030015b5ed470b968b58b4b3d3/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/83008733c091b8a0452428b97e02ad4f482b39f0a30edb8889715fe0d290ec2e/contract';
import startContract from '../../snapshots/83008733c091b8a0452428b97e02ad4f482b39f0a30edb8889715fe0d290ec2e/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'portal_notification_reads',
        columns: [
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('read_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('record_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('user_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'portal_preferences',
        columns: [
          col('payload', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('updated_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('user_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('version', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [primaryKey(['user_id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'promo_codes',
        columns: [
          col('code', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('payload', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('version', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [primaryKey(['code'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'promo_redemptions',
        columns: [
          col('code', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('expires_at', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('user_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'portal_notification_reads',
        constraint: 'portal_notification_read_owner',
        columns: ['user_id', 'record_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'promo_redemptions',
        constraint: 'promo_redemption_once',
        columns: ['code', 'user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'promo_redemptions',
        index: 'promo_entitlement_expiry',
        columns: ['user_id', 'expires_at'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'portal_notification_reads',
        foreignKey: {
          name: 'portal_notification_reads_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'portal_preferences',
        foreignKey: {
          name: 'portal_preferences_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'promo_redemptions',
        foreignKey: {
          name: 'promo_redemptions_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'promo_redemptions',
        foreignKey: {
          name: 'promo_redemptions_code_fkey',
          columns: ['code'],
          references: { schema: 'public', table: 'promo_codes', columns: ['code'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'portal_notification_reads' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'portal_preferences' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'promo_codes' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'promo_redemptions' }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'portal_notification_reads',
        policy: {
          naming: { kind: 'wire', prefix: 'portal_notification_mark', hash: '32894381' },
          tableName: 'portal_notification_reads',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck: "user_id=nullif(current_setting('vops.user_id',true),'')::integer",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'portal_notification_reads',
        policy: {
          naming: { kind: 'wire', prefix: 'portal_notification_read', hash: 'eb9ee7c4' },
          tableName: 'portal_notification_reads',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using: "user_id=nullif(current_setting('vops.user_id',true),'')::integer",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'portal_preferences',
        policy: {
          naming: { kind: 'wire', prefix: 'portal_preferences_create', hash: '32894381' },
          tableName: 'portal_preferences',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck: "user_id=nullif(current_setting('vops.user_id',true),'')::integer",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'portal_preferences',
        policy: {
          naming: { kind: 'wire', prefix: 'portal_preferences_read', hash: 'eb9ee7c4' },
          tableName: 'portal_preferences',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using: "user_id=nullif(current_setting('vops.user_id',true),'')::integer",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'portal_preferences',
        policy: {
          naming: { kind: 'wire', prefix: 'portal_preferences_update', hash: '31b62e0c' },
          tableName: 'portal_preferences',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using: "user_id=nullif(current_setting('vops.user_id',true),'')::integer",
          withCheck: "user_id=nullif(current_setting('vops.user_id',true),'')::integer",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'promo_codes',
        policy: {
          naming: { kind: 'wire', prefix: 'promo_code_create', hash: '173d0e5a' },
          tableName: 'promo_codes',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck: "current_setting('vops.platform',true)='true'",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'promo_codes',
        policy: {
          naming: { kind: 'wire', prefix: 'promo_code_manage', hash: '77142426' },
          tableName: 'promo_codes',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using: "current_setting('vops.platform',true)='true'",
          withCheck: "current_setting('vops.platform',true)='true'",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'promo_codes',
        policy: {
          naming: { kind: 'wire', prefix: 'promo_code_read', hash: '30c7ca1f' },
          tableName: 'promo_codes',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "current_setting('vops.platform',true)='true' OR code=current_setting('vops.promo_code',true)",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'promo_redemptions',
        policy: {
          naming: { kind: 'wire', prefix: 'promo_redemption_create', hash: '3efa5144' },
          tableName: 'promo_redemptions',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck:
            "user_id=nullif(current_setting('vops.user_id',true),'')::integer AND code=current_setting('vops.promo_code',true)",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'promo_redemptions',
        policy: {
          naming: { kind: 'wire', prefix: 'promo_redemption_read', hash: '9ee541f6' },
          tableName: 'promo_redemptions',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "user_id=nullif(current_setting('vops.user_id',true),'')::integer OR current_setting('vops.platform',true)='true' OR code=current_setting('vops.promo_code',true)",
          permissive: true,
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
