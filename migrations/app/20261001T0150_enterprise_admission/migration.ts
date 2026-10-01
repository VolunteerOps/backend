#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/041cae8d47a4c7c1ab771e1f4da766e47139da8e3a652736111b2030e6e73c49/contract';
import startContract from '../../snapshots/041cae8d47a4c7c1ab771e1f4da766e47139da8e3a652736111b2030e6e73c49/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/baa046a11b2e2ece7a32b8254a5dcde8fd7c30fb09ac92cd7e1cb06634e8431d/contract';
import endContract from '../../snapshots/baa046a11b2e2ece7a32b8254a5dcde8fd7c30fb09ac92cd7e1cb06634e8431d/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'coordination_grants',
        columns: [
          col('accepted_at', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
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
          col('lead_organization_id', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('organization_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('partner_organization_id', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('resource_reference', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('revoked_at', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'domain_claims',
        columns: [
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('disputed', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('domain', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('expires_at', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organization_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('token_hash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('verified_until', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'partner_applications',
        columns: [
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('domain', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('message', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organization_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('review_reason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
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
        table: 'support_access_grants',
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
          col('organization_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reason', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('revoked_at', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('user_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'domain_claims',
        constraint: 'domain_claims_domain_key',
        columns: ['domain'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'coordination_grants',
        foreignKey: {
          name: 'coordination_grants_organization_id_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'domain_claims',
        foreignKey: {
          name: 'domain_claims_organization_id_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'partner_applications',
        foreignKey: {
          name: 'partner_applications_organization_id_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'partner_applications',
        foreignKey: {
          name: 'partner_applications_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'support_access_grants',
        foreignKey: {
          name: 'support_access_grants_organization_id_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'support_access_grants',
        foreignKey: {
          name: 'support_access_grants_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'coordination_grants' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'domain_claims' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'partner_applications' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'support_access_grants' }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'coordination_grants',
        policy: {
          naming: { kind: 'wire', prefix: 'coordination_grants_insert', hash: '4bfd3efa' },
          tableName: 'coordination_grants',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck:
            "organization_id = current_setting('vops.organization_id', true) AND current_setting('vops.roster', true) = 'true'",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'coordination_grants',
        policy: {
          naming: { kind: 'wire', prefix: 'coordination_grants_select', hash: 'f229453e' },
          tableName: 'coordination_grants',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "organization_id = current_setting('vops.organization_id', true) OR partner_organization_id = current_setting('vops.organization_id', true) OR current_setting('vops.platform', true) = 'true'",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'coordination_grants',
        policy: {
          naming: { kind: 'wire', prefix: 'coordination_grants_update', hash: '0f20a84f' },
          tableName: 'coordination_grants',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using:
            "organization_id = current_setting('vops.organization_id', true) OR partner_organization_id = current_setting('vops.organization_id', true) OR current_setting('vops.platform', true) = 'true'",
          withCheck:
            "organization_id = current_setting('vops.organization_id', true) OR partner_organization_id = current_setting('vops.organization_id', true) OR current_setting('vops.platform', true) = 'true'",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'domain_claims',
        policy: {
          naming: { kind: 'wire', prefix: 'domain_claims_insert', hash: '4bfd3efa' },
          tableName: 'domain_claims',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck:
            "organization_id = current_setting('vops.organization_id', true) AND current_setting('vops.roster', true) = 'true'",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'domain_claims',
        policy: {
          naming: { kind: 'wire', prefix: 'domain_claims_select', hash: '311c9eac' },
          tableName: 'domain_claims',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "organization_id = current_setting('vops.organization_id', true) OR current_setting('vops.platform', true) = 'true'",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'domain_claims',
        policy: {
          naming: { kind: 'wire', prefix: 'domain_claims_update', hash: 'b70a713e' },
          tableName: 'domain_claims',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using:
            "organization_id = current_setting('vops.organization_id', true) OR current_setting('vops.platform', true) = 'true'",
          withCheck:
            "organization_id = current_setting('vops.organization_id', true) OR current_setting('vops.platform', true) = 'true'",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'partner_applications',
        policy: {
          naming: { kind: 'wire', prefix: 'partner_applications_insert', hash: '7bfc6356' },
          tableName: 'partner_applications',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck: "user_id = nullif(current_setting('vops.user_id', true), '')::integer",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'partner_applications',
        policy: {
          naming: { kind: 'wire', prefix: 'partner_applications_select', hash: '576a0082' },
          tableName: 'partner_applications',
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
        table: 'partner_applications',
        policy: {
          naming: { kind: 'wire', prefix: 'partner_applications_update', hash: '98dabbde' },
          tableName: 'partner_applications',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using: "current_setting('vops.platform', true) = 'true'",
          withCheck: "current_setting('vops.platform', true) = 'true'",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'platform_grants',
        policy: {
          naming: { kind: 'wire', prefix: 'platform_manage_insert', hash: 'e5ceb5b3' },
          tableName: 'platform_grants',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck: "current_setting('vops.platform', true) = 'true'",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'platform_grants',
        policy: {
          naming: { kind: 'wire', prefix: 'platform_manage_read', hash: '7c7a5a76' },
          tableName: 'platform_grants',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using: "current_setting('vops.platform', true) = 'true'",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'platform_grants',
        policy: {
          naming: { kind: 'wire', prefix: 'platform_manage_update', hash: '98dabbde' },
          tableName: 'platform_grants',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using: "current_setting('vops.platform', true) = 'true'",
          withCheck: "current_setting('vops.platform', true) = 'true'",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'support_access_grants',
        policy: {
          naming: { kind: 'wire', prefix: 'support_access_grants_insert', hash: 'e5ceb5b3' },
          tableName: 'support_access_grants',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck: "current_setting('vops.platform', true) = 'true'",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'support_access_grants',
        policy: {
          naming: { kind: 'wire', prefix: 'support_access_grants_select', hash: '311c9eac' },
          tableName: 'support_access_grants',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "organization_id = current_setting('vops.organization_id', true) OR current_setting('vops.platform', true) = 'true'",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'support_access_grants',
        policy: {
          naming: { kind: 'wire', prefix: 'support_access_grants_update', hash: 'b70a713e' },
          tableName: 'support_access_grants',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using:
            "organization_id = current_setting('vops.organization_id', true) OR current_setting('vops.platform', true) = 'true'",
          withCheck:
            "organization_id = current_setting('vops.organization_id', true) OR current_setting('vops.platform', true) = 'true'",
          permissive: true,
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
