#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/2e818e74020d477243a5385c079065efcc7cacc4348e0183656cf6e7f2de9100/contract';
import startContract from '../../snapshots/2e818e74020d477243a5385c079065efcc7cacc4348e0183656cf6e7f2de9100/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/88d8acb6f3097aa0311fd740431eace7201b8bde39f64d59b96577a9e7eec5e6/contract';
import endContract from '../../snapshots/88d8acb6f3097aa0311fd740431eace7201b8bde39f64d59b96577a9e7eec5e6/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'ingress_receipts',
        columns: [
          col('accepted_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('consent_version', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('device_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('expires_at', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('message_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organization_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('payload_hash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'member_devices',
        columns: [
          col('battery_percent', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('consent_version', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('installation_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('last_heartbeat_at', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('location_consent', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('membership_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organization_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('platform', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('relay_consent', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('revoked_at', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('sensing_consent', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('updated_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'ingress_receipts',
        constraint: 'ingress_receipts_organization_id_device_id_message_id_key',
        columns: ['organization_id', 'device_id', 'message_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'member_devices',
        constraint: 'member_devices_organization_id_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'member_devices',
        constraint: 'member_devices_organization_id_membership_id_installation_id_key',
        columns: ['organization_id', 'membership_id', 'installation_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'organization_memberships',
        constraint: 'organization_memberships_organization_id_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ingress_receipts',
        index: 'ingress_receipts_expires_at_idx_35365ada',
        columns: ['expires_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ingress_receipts',
        index: 'ingress_receipts_organization_id_device_id_idx_c84c447d',
        columns: ['organization_id', 'device_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'member_devices',
        index: 'member_devices_organization_id_membership_id_idx_9bf738d3',
        columns: ['organization_id', 'membership_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ingress_receipts',
        foreignKey: {
          name: 'ingress_receipts_organization_id_device_id_fkey',
          columns: ['organization_id', 'device_id'],
          references: {
            schema: 'public',
            table: 'member_devices',
            columns: ['organization_id', 'id'],
          },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'member_devices',
        foreignKey: {
          name: 'member_devices_organization_id_membership_id_fkey',
          columns: ['organization_id', 'membership_id'],
          references: {
            schema: 'public',
            table: 'organization_memberships',
            columns: ['organization_id', 'id'],
          },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'ingress_receipts' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'member_devices' }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'ingress_receipts',
        policy: {
          naming: { kind: 'wire', prefix: 'receipt_insert', hash: '17192fff' },
          tableName: 'ingress_receipts',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND EXISTS (SELECT 1 FROM public.member_devices d WHERE d.id = ingress_receipts.device_id AND d.organization_id = ingress_receipts.organization_id AND d.revoked_at IS NULL)",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'ingress_receipts',
        policy: {
          naming: { kind: 'wire', prefix: 'receipt_select', hash: '5bafdb74' },
          tableName: 'ingress_receipts',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND EXISTS (SELECT 1 FROM public.member_devices d WHERE d.id = ingress_receipts.device_id AND d.organization_id = ingress_receipts.organization_id AND d.revoked_at IS NULL)",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'member_devices',
        policy: {
          naming: { kind: 'wire', prefix: 'device_insert', hash: 'bd75ec6d' },
          tableName: 'member_devices',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.id = member_devices.membership_id AND m.organization_id = member_devices.organization_id AND m.user_id = nullif(current_setting('vops.user_id', true), '')::integer AND m.status = 'ACTIVE')",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'member_devices',
        policy: {
          naming: { kind: 'wire', prefix: 'device_select', hash: '5024cde0' },
          tableName: 'member_devices',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.id = member_devices.membership_id AND m.organization_id = member_devices.organization_id AND m.user_id = nullif(current_setting('vops.user_id', true), '')::integer AND m.status = 'ACTIVE')",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'member_devices',
        policy: {
          naming: { kind: 'wire', prefix: 'device_update', hash: '881dddae' },
          tableName: 'member_devices',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.id = member_devices.membership_id AND m.organization_id = member_devices.organization_id AND m.user_id = nullif(current_setting('vops.user_id', true), '')::integer AND m.status = 'ACTIVE')",
          withCheck:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.id = member_devices.membership_id AND m.organization_id = member_devices.organization_id AND m.user_id = nullif(current_setting('vops.user_id', true), '')::integer AND m.status = 'ACTIVE')",
          permissive: true,
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
