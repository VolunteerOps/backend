#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/7f31e09af996268dfba89c50a537d7876f490d9ba042aec960791ff55ff28b21/contract';
import startContract from '../../snapshots/7f31e09af996268dfba89c50a537d7876f490d9ba042aec960791ff55ff28b21/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/990961d70f672d4263adfbc296869480eebb8ecbd30e9a70078c0c4012adf8aa/contract';
import endContract from '../../snapshots/990961d70f672d4263adfbc296869480eebb8ecbd30e9a70078c0c4012adf8aa/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'stored_objects',
        columns: [
          col('bucket', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('byte_size', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('checksum_sha256', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('completed_at', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('content_type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('etag', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('expires_at', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('file_name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('object_key', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organization_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('region_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('state', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('uploader_user_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('version_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'stored_object_completion_a37fde25',
            "(state = 'PENDING' AND completed_at IS NULL) OR (state = 'READY' AND completed_at IS NOT NULL AND etag IS NOT NULL)",
          ),
          checkExpression('stored_object_size_44a2044e', 'byte_size > 0 AND byte_size <= 10485760'),
          checkExpression('stored_object_state_a37b3d27', "state IN ('PENDING', 'READY')"),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'stored_objects',
        constraint: 'stored_objects_object_key_key',
        columns: ['object_key'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'stored_objects',
        index: 'stored_object_expiry_idx',
        columns: ['state', 'expires_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'stored_objects',
        index: 'stored_object_owner_idx',
        columns: ['organization_id', 'region_id', 'uploader_user_id', 'created_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'stored_objects',
        index: 'stored_objects_organization_id_region_id_idx_19d4ff55',
        columns: ['organization_id', 'region_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'stored_objects',
        index: 'stored_objects_organization_id_uploader_user_id_idx_4edc31af',
        columns: ['organization_id', 'uploader_user_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'stored_objects',
        foreignKey: {
          name: 'stored_objects_organization_id_region_id_fkey',
          columns: ['organization_id', 'region_id'],
          references: {
            schema: 'public',
            table: 'organization_units',
            columns: ['organization_id', 'id'],
          },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'stored_objects',
        foreignKey: {
          name: 'stored_objects_organization_id_uploader_user_id_fkey',
          columns: ['organization_id', 'uploader_user_id'],
          references: {
            schema: 'public',
            table: 'organization_memberships',
            columns: ['organization_id', 'user_id'],
          },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'stored_objects' }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'stored_objects',
        policy: {
          naming: { kind: 'wire', prefix: 'stored_object_complete', hash: 'a84ca85a' },
          tableName: 'stored_objects',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND region_id = nullif(current_setting('vops.region_id', true), '') AND uploader_user_id = nullif(current_setting('vops.user_id', true), '')::integer AND state = 'PENDING'",
          withCheck:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND region_id = nullif(current_setting('vops.region_id', true), '') AND uploader_user_id = nullif(current_setting('vops.user_id', true), '')::integer AND state = 'READY'",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'stored_objects',
        policy: {
          naming: { kind: 'wire', prefix: 'stored_object_create', hash: 'd2a716b1' },
          tableName: 'stored_objects',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND region_id = nullif(current_setting('vops.region_id', true), '') AND uploader_user_id = nullif(current_setting('vops.user_id', true), '')::integer AND state = 'PENDING'",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'stored_objects',
        policy: {
          naming: { kind: 'wire', prefix: 'stored_object_read', hash: 'a69f9fa0' },
          tableName: 'stored_objects',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND region_id = nullif(current_setting('vops.region_id', true), '') AND uploader_user_id = nullif(current_setting('vops.user_id', true), '')::integer",
          permissive: true,
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
