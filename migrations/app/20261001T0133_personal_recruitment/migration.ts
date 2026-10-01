#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/317429c4c267e61610b01e1c988b7c86d49fb8317c1c058ffc7ba3bc748ef2a3/contract';
import startContract from '../../snapshots/317429c4c267e61610b01e1c988b7c86d49fb8317c1c058ffc7ba3bc748ef2a3/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/adb4ba9ca5a97be295d907a07363004f8e89bfdc657d8f21611133897fa1df5f/contract';
import endContract from '../../snapshots/adb4ba9ca5a97be295d907a07363004f8e89bfdc657d8f21611133897fa1df5f/contract.json' with { type: 'json' };
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
        table: 'account_deletion_requests',
        columns: [
          col('cancelled_at', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('requested_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('REQUESTED'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('user_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['user_id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'consent_records',
        columns: [
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('granted', 'bool', { notNull: true, codecRef: { codecId: 'pg/bool@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('policy_version', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('purpose', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('user_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'directory_preferences',
        columns: [
          col('availability', 'text', {
            notNull: true,
            default: lit('UNSPECIFIED'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('biography', 'text', {
            notNull: true,
            default: lit(''),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('discoverable', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('display_name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('public_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('public_preview', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('region', 'text', {
            notNull: true,
            default: lit(''),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('show_availability', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('skills', 'text[]', {
            notNull: true,
            default: lit([]),
            codecRef: { codecId: 'pg/text@1', many: true },
          }),
          col('user_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('version', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [
          primaryKey(['user_id']),
          checkExpression(
            'directory_preferences_skills_elem_not_null_79c19a4f',
            'array_position("skills", NULL) IS NULL',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'join_requests',
        columns: [
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('message', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organization_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('user_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('version', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'personal_audit',
        columns: [
          col('action', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('actor_user_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('user_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'profile_shares',
        columns: [
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
          col('revoked_at', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('token_hash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('user_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'recruitment_blocks',
        columns: [
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organization_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('user_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'recruitment_reports',
        columns: [
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organization_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reason', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('user_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'volunteer_profiles',
        columns: [
          col('availability', 'text', {
            notNull: true,
            default: lit('UNSPECIFIED'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('biography', 'text', {
            notNull: true,
            default: lit(''),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('display_name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('private_details', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('public_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('region', 'text', {
            notNull: true,
            default: lit(''),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('skills', 'text[]', {
            notNull: true,
            default: lit([]),
            codecRef: { codecId: 'pg/text@1', many: true },
          }),
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
        constraints: [
          primaryKey(['user_id']),
          checkExpression(
            'volunteer_profiles_skills_elem_not_null_79c19a4f',
            'array_position("skills", NULL) IS NULL',
          ),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'organization_invitations',
        column: col('declined_at', 'timestamp(3)', {
          codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'organization_invitations',
        column: col('delivery_status', 'text', {
          notNull: true,
          default: lit('NOT_CONFIGURED'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'organization_invitations',
        column: col('issuer_membership_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'organization_invitations',
        column: col('issuer_membership_version', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'organization_invitations',
        column: col('recipient_user_id', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'account_deletion_requests',
        constraint: 'account_deletion_requests_id_key',
        columns: ['id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'directory_preferences',
        constraint: 'directory_preferences_public_id_key',
        columns: ['public_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'join_requests',
        constraint: 'join_requests_user_id_organization_id_key',
        columns: ['user_id', 'organization_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'profile_shares',
        constraint: 'profile_shares_token_hash_key',
        columns: ['token_hash'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'recruitment_blocks',
        constraint: 'recruitment_blocks_user_id_organization_id_key',
        columns: ['user_id', 'organization_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'volunteer_profiles',
        constraint: 'volunteer_profiles_public_id_key',
        columns: ['public_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'consent_records',
        index: 'consent_records_user_id_created_at_idx_b562028f',
        columns: ['user_id', 'created_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'consent_records',
        index: 'consent_records_user_id_idx_6c952402',
        columns: ['user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'directory_preferences',
        index: 'directory_region_cursor_idx',
        columns: ['discoverable', 'region', 'public_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'join_requests',
        index: 'join_requests_user_id_idx_6c952402',
        columns: ['user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'organization_invitations',
        index: 'invitation_recipient_date_idx',
        columns: ['recipient_email', 'created_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'personal_audit',
        index: 'personal_audit_user_id_created_at_idx_b562028f',
        columns: ['user_id', 'created_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'personal_audit',
        index: 'personal_audit_user_id_idx_6c952402',
        columns: ['user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'profile_shares',
        index: 'profile_shares_user_id_idx_6c952402',
        columns: ['user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'recruitment_blocks',
        index: 'recruitment_blocks_user_id_idx_6c952402',
        columns: ['user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'recruitment_reports',
        index: 'recruitment_reports_user_id_idx_6c952402',
        columns: ['user_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'account_deletion_requests',
        foreignKey: {
          name: 'account_deletion_requests_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'consent_records',
        foreignKey: {
          name: 'consent_records_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'directory_preferences',
        foreignKey: {
          name: 'directory_preferences_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'join_requests',
        foreignKey: {
          name: 'join_requests_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'join_requests',
        foreignKey: {
          name: 'join_requests_organization_id_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'personal_audit',
        foreignKey: {
          name: 'personal_audit_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'profile_shares',
        foreignKey: {
          name: 'profile_shares_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'recruitment_blocks',
        foreignKey: {
          name: 'recruitment_blocks_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'recruitment_blocks',
        foreignKey: {
          name: 'recruitment_blocks_organization_id_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'recruitment_reports',
        foreignKey: {
          name: 'recruitment_reports_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'recruitment_reports',
        foreignKey: {
          name: 'recruitment_reports_organization_id_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'volunteer_profiles',
        foreignKey: {
          name: 'volunteer_profiles_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'account_deletion_requests' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'consent_records' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'directory_preferences' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'join_requests' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'personal_audit' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'profile_shares' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'recruitment_blocks' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'recruitment_reports' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'volunteer_profiles' }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'account_deletion_requests',
        policy: {
          naming: { kind: 'wire', prefix: 'account_deletion_requests_insert', hash: '7bfc6356' },
          tableName: 'account_deletion_requests',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck: "user_id = nullif(current_setting('vops.user_id', true), '')::integer",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'account_deletion_requests',
        policy: {
          naming: { kind: 'wire', prefix: 'account_deletion_requests_select', hash: '95582c40' },
          tableName: 'account_deletion_requests',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using: "user_id = nullif(current_setting('vops.user_id', true), '')::integer",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'account_deletion_requests',
        policy: {
          naming: { kind: 'wire', prefix: 'account_deletion_requests_update', hash: '1abd90af' },
          tableName: 'account_deletion_requests',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using: "user_id = nullif(current_setting('vops.user_id', true), '')::integer",
          withCheck: "user_id = nullif(current_setting('vops.user_id', true), '')::integer",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'consent_records',
        policy: {
          naming: { kind: 'wire', prefix: 'consent_records_insert', hash: '7bfc6356' },
          tableName: 'consent_records',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck: "user_id = nullif(current_setting('vops.user_id', true), '')::integer",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'consent_records',
        policy: {
          naming: { kind: 'wire', prefix: 'consent_records_select', hash: '95582c40' },
          tableName: 'consent_records',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using: "user_id = nullif(current_setting('vops.user_id', true), '')::integer",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'directory_preferences',
        policy: {
          naming: { kind: 'wire', prefix: 'directory_preferences_insert', hash: '7bfc6356' },
          tableName: 'directory_preferences',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck: "user_id = nullif(current_setting('vops.user_id', true), '')::integer",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'directory_preferences',
        policy: {
          naming: { kind: 'wire', prefix: 'directory_preferences_select', hash: 'a08754ba' },
          tableName: 'directory_preferences',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "user_id = nullif(current_setting('vops.user_id', true), '')::integer OR (discoverable AND current_setting('vops.directory', true) = 'true' AND NOT EXISTS (SELECT 1 FROM public.recruitment_blocks b WHERE b.user_id = directory_preferences.user_id AND b.organization_id = current_setting('vops.organization_id', true))) OR (public_preview AND EXISTS (SELECT 1 FROM public.profile_shares s WHERE s.user_id = directory_preferences.user_id AND s.token_hash = current_setting('vops.share_hash', true) AND s.revoked_at IS NULL AND s.expires_at > now()))",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'directory_preferences',
        policy: {
          naming: { kind: 'wire', prefix: 'directory_preferences_update', hash: '1abd90af' },
          tableName: 'directory_preferences',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using: "user_id = nullif(current_setting('vops.user_id', true), '')::integer",
          withCheck: "user_id = nullif(current_setting('vops.user_id', true), '')::integer",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'join_requests',
        policy: {
          naming: { kind: 'wire', prefix: 'join_requests_insert', hash: '7bfc6356' },
          tableName: 'join_requests',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck: "user_id = nullif(current_setting('vops.user_id', true), '')::integer",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'join_requests',
        policy: {
          naming: { kind: 'wire', prefix: 'join_requests_select', hash: '3e45ce8f' },
          tableName: 'join_requests',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "user_id = nullif(current_setting('vops.user_id', true), '')::integer OR (organization_id = current_setting('vops.organization_id', true) AND current_setting('vops.roster', true) = 'true')",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'join_requests',
        policy: {
          naming: { kind: 'wire', prefix: 'join_requests_update', hash: 'c2428490' },
          tableName: 'join_requests',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using:
            "user_id = nullif(current_setting('vops.user_id', true), '')::integer OR (organization_id = current_setting('vops.organization_id', true) AND current_setting('vops.roster', true) = 'true')",
          withCheck:
            "user_id = nullif(current_setting('vops.user_id', true), '')::integer OR (organization_id = current_setting('vops.organization_id', true) AND current_setting('vops.roster', true) = 'true')",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'organization_invitations',
        policy: {
          naming: { kind: 'wire', prefix: 'invitation_consume', hash: '379b1ac6' },
          tableName: 'organization_invitations',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using:
            "(current_setting('vops.platform', true) = 'true' AND EXISTS (SELECT 1 FROM public.platform_grants g WHERE g.user_id = nullif(current_setting('vops.user_id', true), '')::integer AND g.active AND g.role = 'TECH_ADMIN')) OR (organization_id = nullif(current_setting('vops.organization_id', true), '') AND current_setting('vops.roster', true) = 'true') OR recipient_email = current_setting('vops.email', true)",
          withCheck:
            "(current_setting('vops.platform', true) = 'true' AND EXISTS (SELECT 1 FROM public.platform_grants g WHERE g.user_id = nullif(current_setting('vops.user_id', true), '')::integer AND g.active AND g.role = 'TECH_ADMIN')) OR (organization_id = nullif(current_setting('vops.organization_id', true), '') AND current_setting('vops.roster', true) = 'true') OR recipient_email = current_setting('vops.email', true)",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'organization_invitations',
        policy: {
          naming: { kind: 'wire', prefix: 'invitation_read', hash: 'fca90d31' },
          tableName: 'organization_invitations',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "(current_setting('vops.platform', true) = 'true' AND EXISTS (SELECT 1 FROM public.platform_grants g WHERE g.user_id = nullif(current_setting('vops.user_id', true), '')::integer AND g.active AND g.role = 'TECH_ADMIN')) OR (organization_id = nullif(current_setting('vops.organization_id', true), '') AND current_setting('vops.roster', true) = 'true') OR recipient_email = current_setting('vops.email', true)",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'personal_audit',
        policy: {
          naming: { kind: 'wire', prefix: 'personal_audit_insert', hash: '7bfc6356' },
          tableName: 'personal_audit',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck: "user_id = nullif(current_setting('vops.user_id', true), '')::integer",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'personal_audit',
        policy: {
          naming: { kind: 'wire', prefix: 'personal_audit_select', hash: '95582c40' },
          tableName: 'personal_audit',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using: "user_id = nullif(current_setting('vops.user_id', true), '')::integer",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'platform_grants',
        policy: {
          naming: { kind: 'wire', prefix: 'platform_self', hash: '0fb9c30e' },
          tableName: 'platform_grants',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "user_id = nullif(current_setting('vops.user_id', true), '')::integer OR user_id = nullif(current_setting('vops.invitation_issuer', true), '')::integer",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'profile_shares',
        policy: {
          naming: { kind: 'wire', prefix: 'profile_shares_insert', hash: '7bfc6356' },
          tableName: 'profile_shares',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck: "user_id = nullif(current_setting('vops.user_id', true), '')::integer",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'profile_shares',
        policy: {
          naming: { kind: 'wire', prefix: 'profile_shares_select', hash: '22402a5c' },
          tableName: 'profile_shares',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "user_id = nullif(current_setting('vops.user_id', true), '')::integer OR (token_hash = current_setting('vops.share_hash', true) AND revoked_at IS NULL AND expires_at > now())",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'profile_shares',
        policy: {
          naming: { kind: 'wire', prefix: 'profile_shares_update', hash: '1abd90af' },
          tableName: 'profile_shares',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using: "user_id = nullif(current_setting('vops.user_id', true), '')::integer",
          withCheck: "user_id = nullif(current_setting('vops.user_id', true), '')::integer",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'recruitment_blocks',
        policy: {
          naming: { kind: 'wire', prefix: 'recruitment_blocks_insert', hash: '7bfc6356' },
          tableName: 'recruitment_blocks',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck: "user_id = nullif(current_setting('vops.user_id', true), '')::integer",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'recruitment_blocks',
        policy: {
          naming: { kind: 'wire', prefix: 'recruitment_blocks_select', hash: '3e238f38' },
          tableName: 'recruitment_blocks',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "user_id = nullif(current_setting('vops.user_id', true), '')::integer OR organization_id = current_setting('vops.organization_id', true)",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'recruitment_blocks',
        policy: {
          naming: { kind: 'wire', prefix: 'recruitment_blocks_update', hash: '1abd90af' },
          tableName: 'recruitment_blocks',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using: "user_id = nullif(current_setting('vops.user_id', true), '')::integer",
          withCheck: "user_id = nullif(current_setting('vops.user_id', true), '')::integer",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'recruitment_reports',
        policy: {
          naming: { kind: 'wire', prefix: 'recruitment_reports_insert', hash: '7bfc6356' },
          tableName: 'recruitment_reports',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck: "user_id = nullif(current_setting('vops.user_id', true), '')::integer",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'recruitment_reports',
        policy: {
          naming: { kind: 'wire', prefix: 'recruitment_reports_select', hash: '576a0082' },
          tableName: 'recruitment_reports',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "user_id = nullif(current_setting('vops.user_id', true), '')::integer OR current_setting('vops.platform', true) = 'true'",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'recruitment_reports',
        policy: {
          naming: { kind: 'wire', prefix: 'recruitment_reports_update', hash: '1abd90af' },
          tableName: 'recruitment_reports',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using: "user_id = nullif(current_setting('vops.user_id', true), '')::integer",
          withCheck: "user_id = nullif(current_setting('vops.user_id', true), '')::integer",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'volunteer_profiles',
        policy: {
          naming: { kind: 'wire', prefix: 'volunteer_profiles_insert', hash: '7bfc6356' },
          tableName: 'volunteer_profiles',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck: "user_id = nullif(current_setting('vops.user_id', true), '')::integer",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'volunteer_profiles',
        policy: {
          naming: { kind: 'wire', prefix: 'volunteer_profiles_select', hash: '95582c40' },
          tableName: 'volunteer_profiles',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using: "user_id = nullif(current_setting('vops.user_id', true), '')::integer",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'volunteer_profiles',
        policy: {
          naming: { kind: 'wire', prefix: 'volunteer_profiles_update', hash: '1abd90af' },
          tableName: 'volunteer_profiles',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using: "user_id = nullif(current_setting('vops.user_id', true), '')::integer",
          withCheck: "user_id = nullif(current_setting('vops.user_id', true), '')::integer",
          permissive: true,
        },
      }),
      this.dropRlsPolicy({
        schema: 'public',
        table: 'organization_invitations',
        policy: 'invitation_consume_a24f5380',
      }),
      this.dropRlsPolicy({
        schema: 'public',
        table: 'organization_invitations',
        policy: 'invitation_read_061c49a5',
      }),
      this.dropRlsPolicy({
        schema: 'public',
        table: 'platform_grants',
        policy: 'platform_self_95582c40',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
