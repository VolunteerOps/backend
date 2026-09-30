#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/4d42caf375175aa8be08039cca054abe0469a5d505d3d6e833a11547f4c47431/contract';
import endContract from '../../snapshots/4d42caf375175aa8be08039cca054abe0469a5d505d3d6e833a11547f4c47431/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/88d8acb6f3097aa0311fd740431eace7201b8bde39f64d59b96577a9e7eec5e6/contract';
import startContract from '../../snapshots/88d8acb6f3097aa0311fd740431eace7201b8bde39f64d59b96577a9e7eec5e6/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropConstraint({
        schema: 'public',
        table: 'communications',
        constraint: 'communications_event_id_fkey',
        kind: 'foreignKey',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'deployments',
        constraint: 'deployments_event_id_fkey',
        kind: 'foreignKey',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'deployments',
        constraint: 'deployments_volunteer_id_fkey',
        kind: 'foreignKey',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'events',
        constraint: 'events_location_id_fkey',
        kind: 'foreignKey',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'feedback',
        constraint: 'feedback_deployment_id_fkey',
        kind: 'foreignKey',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'feedback',
        constraint: 'feedback_event_id_fkey',
        kind: 'foreignKey',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'feedback',
        constraint: 'feedback_volunteer_id_fkey',
        kind: 'foreignKey',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'field_reports',
        constraint: 'field_reports_deployment_id_fkey',
        kind: 'foreignKey',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'notifications',
        constraint: 'notifications_event_id_fkey',
        kind: 'foreignKey',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'notifications',
        constraint: 'notifications_volunteer_id_fkey',
        kind: 'foreignKey',
      }),
      this.dropIndex({ schema: 'public', table: 'skills', index: 'skills_skill_name_key' }),
      this.dropConstraint({
        schema: 'public',
        table: 'telemetry_pings',
        constraint: 'telemetry_pings_volunteer_id_fkey',
        kind: 'foreignKey',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'volunteer_skills',
        constraint: 'volunteer_skills_skill_id_fkey',
        kind: 'foreignKey',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'volunteer_skills',
        constraint: 'volunteer_skills_volunteer_id_fkey',
        kind: 'foreignKey',
      }),
      this.dropIndex({ schema: 'public', table: 'volunteers', index: 'volunteers_email_key' }),
      this.dropConstraint({
        schema: 'public',
        table: 'volunteers',
        constraint: 'volunteers_user_id_key',
      }),
      this.createTable({
        schema: 'public',
        table: 'forecast_runs',
        columns: [
          col('cells', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('expires_at', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('init_time', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('model', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organization_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('payload_hash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('quality', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('region_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('retrieved_at', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('source', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'organization_units',
        columns: [
          col('active', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('forecast_bounds', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
          col('forecast_policy', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organization_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'communications',
        column: col('organization_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'communications',
        column: col('region_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'feedback',
        column: col('organization_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'feedback',
        column: col('region_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'deployments',
        column: col('organization_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'deployments',
        column: col('region_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'field_reports',
        column: col('organization_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'field_reports',
        column: col('region_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'locations',
        column: col('organization_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'locations',
        column: col('region_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'events',
        column: col('organization_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'events',
        column: col('region_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'notifications',
        column: col('organization_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'notifications',
        column: col('region_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'telemetry_pings',
        column: col('organization_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'telemetry_pings',
        column: col('region_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'skills',
        column: col('organization_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'skills',
        column: col('region_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'volunteer_skills',
        column: col('organization_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'volunteer_skills',
        column: col('region_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'volunteers',
        column: col('organization_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'volunteers',
        column: col('region_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'communications',
        constraint: 'communications_org_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'feedback',
        constraint: 'feedback_org_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'deployments',
        constraint: 'deployments_org_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'field_reports',
        constraint: 'field_reports_org_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'forecast_runs',
        constraint: 'forecast_run_revision_key',
        columns: ['organization_id', 'region_id', 'source', 'init_time', 'payload_hash'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'locations',
        constraint: 'locations_org_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'events',
        constraint: 'events_org_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'notifications',
        constraint: 'notifications_org_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'organization_units',
        constraint: 'organization_units_organization_id_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'telemetry_pings',
        constraint: 'telemetry_pings_org_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'skills',
        constraint: 'skills_org_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'skills',
        constraint: 'skills_org_name_key',
        columns: ['organization_id', 'skill_name'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'volunteer_skills',
        constraint: 'volunteer_skills_org_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'volunteers',
        constraint: 'volunteers_org_email_key',
        columns: ['organization_id', 'email'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'volunteers',
        constraint: 'volunteers_org_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'volunteers',
        constraint: 'volunteers_org_user_key',
        columns: ['organization_id', 'user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'communications',
        index: 'communications_scope_idx',
        columns: ['organization_id', 'region_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'feedback',
        index: 'feedback_scope_idx',
        columns: ['organization_id', 'region_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'deployments',
        index: 'deployments_scope_idx',
        columns: ['organization_id', 'region_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'field_reports',
        index: 'field_reports_scope_idx',
        columns: ['organization_id', 'region_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'forecast_runs',
        index: 'forecast_run_region_time_idx',
        columns: ['organization_id', 'region_id', 'init_time'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'forecast_runs',
        index: 'forecast_runs_organization_id_region_id_idx_19d4ff55',
        columns: ['organization_id', 'region_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'locations',
        index: 'locations_scope_idx',
        columns: ['organization_id', 'region_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'events',
        index: 'events_scope_idx',
        columns: ['organization_id', 'region_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'notifications',
        index: 'notifications_scope_idx',
        columns: ['organization_id', 'region_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'organization_units',
        index: 'organization_units_organization_id_idx_1a5cd3f5',
        columns: ['organization_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'telemetry_pings',
        index: 'telemetry_pings_scope_idx',
        columns: ['organization_id', 'region_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'skills',
        index: 'skills_scope_idx',
        columns: ['organization_id', 'region_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'volunteer_skills',
        index: 'volunteer_skills_scope_idx',
        columns: ['organization_id', 'region_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'volunteers',
        index: 'volunteers_scope_idx',
        columns: ['organization_id', 'region_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'volunteers',
        index: 'volunteers_user_id_idx_6c952402',
        columns: ['user_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'communications',
        foreignKey: {
          name: 'communications_organization_id_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'feedback',
        foreignKey: {
          name: 'feedback_organization_id_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'deployments',
        foreignKey: {
          name: 'deployments_organization_id_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'feedback',
        foreignKey: {
          name: 'feedback_deployment_id_fkey',
          columns: ['organization_id', 'deployment_id'],
          references: {
            schema: 'public',
            table: 'deployments',
            columns: ['organization_id', 'id'],
          },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'field_reports',
        foreignKey: {
          name: 'field_reports_deployment_id_fkey',
          columns: ['organization_id', 'deployment_id'],
          references: {
            schema: 'public',
            table: 'deployments',
            columns: ['organization_id', 'id'],
          },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'field_reports',
        foreignKey: {
          name: 'field_reports_organization_id_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'forecast_runs',
        foreignKey: {
          name: 'forecast_runs_organization_id_region_id_fkey',
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
        table: 'locations',
        foreignKey: {
          name: 'locations_organization_id_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'communications',
        foreignKey: {
          name: 'communications_event_id_fkey',
          columns: ['organization_id', 'event_id'],
          references: { schema: 'public', table: 'events', columns: ['organization_id', 'id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'deployments',
        foreignKey: {
          name: 'deployments_event_id_fkey',
          columns: ['organization_id', 'event_id'],
          references: { schema: 'public', table: 'events', columns: ['organization_id', 'id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'events',
        foreignKey: {
          name: 'events_location_id_fkey',
          columns: ['organization_id', 'location_id'],
          references: { schema: 'public', table: 'locations', columns: ['organization_id', 'id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'events',
        foreignKey: {
          name: 'events_organization_id_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'feedback',
        foreignKey: {
          name: 'feedback_event_id_fkey',
          columns: ['organization_id', 'event_id'],
          references: { schema: 'public', table: 'events', columns: ['organization_id', 'id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'notifications',
        foreignKey: {
          name: 'notifications_event_id_fkey',
          columns: ['organization_id', 'event_id'],
          references: { schema: 'public', table: 'events', columns: ['organization_id', 'id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'notifications',
        foreignKey: {
          name: 'notifications_organization_id_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'organization_units',
        foreignKey: {
          name: 'organization_units_organization_id_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'communications',
        foreignKey: {
          name: 'communications_organization_id_region_id_fkey',
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
        table: 'deployments',
        foreignKey: {
          name: 'deployments_organization_id_region_id_fkey',
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
        table: 'events',
        foreignKey: {
          name: 'events_organization_id_region_id_fkey',
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
        table: 'feedback',
        foreignKey: {
          name: 'feedback_organization_id_region_id_fkey',
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
        table: 'field_reports',
        foreignKey: {
          name: 'field_reports_organization_id_region_id_fkey',
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
        table: 'locations',
        foreignKey: {
          name: 'locations_organization_id_region_id_fkey',
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
        table: 'notifications',
        foreignKey: {
          name: 'notifications_organization_id_region_id_fkey',
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
        table: 'telemetry_pings',
        foreignKey: {
          name: 'telemetry_pings_organization_id_region_id_fkey',
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
        table: 'telemetry_pings',
        foreignKey: {
          name: 'telemetry_pings_organization_id_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'skills',
        foreignKey: {
          name: 'skills_organization_id_region_id_fkey',
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
        table: 'skills',
        foreignKey: {
          name: 'skills_organization_id_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'volunteer_skills',
        foreignKey: {
          name: 'volunteer_skills_organization_id_region_id_fkey',
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
        table: 'volunteer_skills',
        foreignKey: {
          name: 'volunteer_skills_skill_id_fkey',
          columns: ['organization_id', 'skill_id'],
          references: { schema: 'public', table: 'skills', columns: ['organization_id', 'id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'volunteer_skills',
        foreignKey: {
          name: 'volunteer_skills_organization_id_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'deployments',
        foreignKey: {
          name: 'deployments_volunteer_id_fkey',
          columns: ['organization_id', 'volunteer_id'],
          references: { schema: 'public', table: 'volunteers', columns: ['organization_id', 'id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'feedback',
        foreignKey: {
          name: 'feedback_volunteer_id_fkey',
          columns: ['organization_id', 'volunteer_id'],
          references: { schema: 'public', table: 'volunteers', columns: ['organization_id', 'id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'notifications',
        foreignKey: {
          name: 'notifications_volunteer_id_fkey',
          columns: ['organization_id', 'volunteer_id'],
          references: { schema: 'public', table: 'volunteers', columns: ['organization_id', 'id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'telemetry_pings',
        foreignKey: {
          name: 'telemetry_pings_volunteer_id_fkey',
          columns: ['organization_id', 'volunteer_id'],
          references: { schema: 'public', table: 'volunteers', columns: ['organization_id', 'id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'volunteer_skills',
        foreignKey: {
          name: 'volunteer_skills_volunteer_id_fkey',
          columns: ['organization_id', 'volunteer_id'],
          references: { schema: 'public', table: 'volunteers', columns: ['organization_id', 'id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'volunteers',
        foreignKey: {
          name: 'volunteers_organization_id_region_id_fkey',
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
        table: 'volunteers',
        foreignKey: {
          name: 'volunteers_organization_id_user_id_fkey',
          columns: ['organization_id', 'user_id'],
          references: {
            schema: 'public',
            table: 'organization_memberships',
            columns: ['organization_id', 'user_id'],
          },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'volunteers',
        foreignKey: {
          name: 'volunteers_organization_id_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'communications' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'feedback' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'deployments' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'field_reports' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'forecast_runs' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'locations' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'events' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'notifications' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'organization_units' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'telemetry_pings' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'skills' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'volunteer_skills' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'volunteers' }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'communications',
        policy: {
          naming: { kind: 'wire', prefix: 'communications_insert', hash: '95da9d7f' },
          tableName: 'communications',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR sender_id = nullif(current_setting('vops.user_id', true), '')::integer)",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'communications',
        policy: {
          naming: { kind: 'wire', prefix: 'communications_select', hash: '961a1b14' },
          tableName: 'communications',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR sender_id = nullif(current_setting('vops.user_id', true), '')::integer)",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'communications',
        policy: {
          naming: { kind: 'wire', prefix: 'communications_update', hash: '16e32393' },
          tableName: 'communications',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR sender_id = nullif(current_setting('vops.user_id', true), '')::integer)",
          withCheck:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR sender_id = nullif(current_setting('vops.user_id', true), '')::integer)",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'deployments',
        policy: {
          naming: { kind: 'wire', prefix: 'deployments_insert', hash: 'db768fe7' },
          tableName: 'deployments',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR EXISTS (SELECT 1 FROM public.volunteers v WHERE v.id = deployments.volunteer_id AND v.organization_id = deployments.organization_id AND v.user_id = nullif(current_setting('vops.user_id', true), '')::integer))",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'deployments',
        policy: {
          naming: { kind: 'wire', prefix: 'deployments_select', hash: 'f84213a2' },
          tableName: 'deployments',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR EXISTS (SELECT 1 FROM public.volunteers v WHERE v.id = deployments.volunteer_id AND v.organization_id = deployments.organization_id AND v.user_id = nullif(current_setting('vops.user_id', true), '')::integer))",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'deployments',
        policy: {
          naming: { kind: 'wire', prefix: 'deployments_update', hash: 'e5713ab9' },
          tableName: 'deployments',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR EXISTS (SELECT 1 FROM public.volunteers v WHERE v.id = deployments.volunteer_id AND v.organization_id = deployments.organization_id AND v.user_id = nullif(current_setting('vops.user_id', true), '')::integer))",
          withCheck:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR EXISTS (SELECT 1 FROM public.volunteers v WHERE v.id = deployments.volunteer_id AND v.organization_id = deployments.organization_id AND v.user_id = nullif(current_setting('vops.user_id', true), '')::integer))",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'events',
        policy: {
          naming: { kind: 'wire', prefix: 'events_insert', hash: 'a6f950fa' },
          tableName: 'events',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR false)",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'events',
        policy: {
          naming: { kind: 'wire', prefix: 'events_select', hash: 'bb404630' },
          tableName: 'events',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR true)",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'events',
        policy: {
          naming: { kind: 'wire', prefix: 'events_update', hash: '1d05c47d' },
          tableName: 'events',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR false)",
          withCheck:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR false)",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'feedback',
        policy: {
          naming: { kind: 'wire', prefix: 'feedback_insert', hash: '4391984f' },
          tableName: 'feedback',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR EXISTS (SELECT 1 FROM public.volunteers v WHERE v.id = feedback.volunteer_id AND v.organization_id = feedback.organization_id AND v.user_id = nullif(current_setting('vops.user_id', true), '')::integer))",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'feedback',
        policy: {
          naming: { kind: 'wire', prefix: 'feedback_select', hash: '726f38e2' },
          tableName: 'feedback',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR EXISTS (SELECT 1 FROM public.volunteers v WHERE v.id = feedback.volunteer_id AND v.organization_id = feedback.organization_id AND v.user_id = nullif(current_setting('vops.user_id', true), '')::integer))",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'feedback',
        policy: {
          naming: { kind: 'wire', prefix: 'feedback_update', hash: 'f1bb29ee' },
          tableName: 'feedback',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR EXISTS (SELECT 1 FROM public.volunteers v WHERE v.id = feedback.volunteer_id AND v.organization_id = feedback.organization_id AND v.user_id = nullif(current_setting('vops.user_id', true), '')::integer))",
          withCheck:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR EXISTS (SELECT 1 FROM public.volunteers v WHERE v.id = feedback.volunteer_id AND v.organization_id = feedback.organization_id AND v.user_id = nullif(current_setting('vops.user_id', true), '')::integer))",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'field_reports',
        policy: {
          naming: { kind: 'wire', prefix: 'field_reports_insert', hash: '31774cd8' },
          tableName: 'field_reports',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR EXISTS (SELECT 1 FROM public.deployments d JOIN public.volunteers v ON v.id = d.volunteer_id AND v.organization_id = d.organization_id WHERE d.id = field_reports.deployment_id AND d.organization_id = field_reports.organization_id AND v.user_id = nullif(current_setting('vops.user_id', true), '')::integer))",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'field_reports',
        policy: {
          naming: { kind: 'wire', prefix: 'field_reports_select', hash: 'a791018d' },
          tableName: 'field_reports',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR EXISTS (SELECT 1 FROM public.deployments d JOIN public.volunteers v ON v.id = d.volunteer_id AND v.organization_id = d.organization_id WHERE d.id = field_reports.deployment_id AND d.organization_id = field_reports.organization_id AND v.user_id = nullif(current_setting('vops.user_id', true), '')::integer))",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'field_reports',
        policy: {
          naming: { kind: 'wire', prefix: 'field_reports_update', hash: '9119f22c' },
          tableName: 'field_reports',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR EXISTS (SELECT 1 FROM public.deployments d JOIN public.volunteers v ON v.id = d.volunteer_id AND v.organization_id = d.organization_id WHERE d.id = field_reports.deployment_id AND d.organization_id = field_reports.organization_id AND v.user_id = nullif(current_setting('vops.user_id', true), '')::integer))",
          withCheck:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR EXISTS (SELECT 1 FROM public.deployments d JOIN public.volunteers v ON v.id = d.volunteer_id AND v.organization_id = d.organization_id WHERE d.id = field_reports.deployment_id AND d.organization_id = field_reports.organization_id AND v.user_id = nullif(current_setting('vops.user_id', true), '')::integer))",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'forecast_runs',
        policy: {
          naming: { kind: 'wire', prefix: 'forecast_append', hash: '2a95e05a' },
          tableName: 'forecast_runs',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND region_id = nullif(current_setting('vops.region_id', true), '') AND current_setting('vops.operations', true) = 'true'",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'forecast_runs',
        policy: {
          naming: { kind: 'wire', prefix: 'forecast_read', hash: 'a7c4c47b' },
          tableName: 'forecast_runs',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND region_id = nullif(current_setting('vops.region_id', true), '')",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'locations',
        policy: {
          naming: { kind: 'wire', prefix: 'locations_insert', hash: 'a6f950fa' },
          tableName: 'locations',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR false)",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'locations',
        policy: {
          naming: { kind: 'wire', prefix: 'locations_select', hash: 'bb404630' },
          tableName: 'locations',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR true)",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'locations',
        policy: {
          naming: { kind: 'wire', prefix: 'locations_update', hash: '1d05c47d' },
          tableName: 'locations',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR false)",
          withCheck:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR false)",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'notifications',
        policy: {
          naming: { kind: 'wire', prefix: 'notifications_insert', hash: '45ee2f3d' },
          tableName: 'notifications',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR EXISTS (SELECT 1 FROM public.volunteers v WHERE v.id = notifications.volunteer_id AND v.organization_id = notifications.organization_id AND v.user_id = nullif(current_setting('vops.user_id', true), '')::integer))",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'notifications',
        policy: {
          naming: { kind: 'wire', prefix: 'notifications_select', hash: '3eb813ed' },
          tableName: 'notifications',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR EXISTS (SELECT 1 FROM public.volunteers v WHERE v.id = notifications.volunteer_id AND v.organization_id = notifications.organization_id AND v.user_id = nullif(current_setting('vops.user_id', true), '')::integer))",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'notifications',
        policy: {
          naming: { kind: 'wire', prefix: 'notifications_update', hash: '7f022b20' },
          tableName: 'notifications',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR EXISTS (SELECT 1 FROM public.volunteers v WHERE v.id = notifications.volunteer_id AND v.organization_id = notifications.organization_id AND v.user_id = nullif(current_setting('vops.user_id', true), '')::integer))",
          withCheck:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR EXISTS (SELECT 1 FROM public.volunteers v WHERE v.id = notifications.volunteer_id AND v.organization_id = notifications.organization_id AND v.user_id = nullif(current_setting('vops.user_id', true), '')::integer))",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'organization_units',
        policy: {
          naming: { kind: 'wire', prefix: 'unit_configure', hash: '4b1b110a' },
          tableName: 'organization_units',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND current_setting('vops.operations', true) = 'true' AND current_setting('vops.all_regions', true) = 'true'",
          withCheck:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND current_setting('vops.operations', true) = 'true' AND current_setting('vops.all_regions', true) = 'true'",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'organization_units',
        policy: {
          naming: { kind: 'wire', prefix: 'unit_create', hash: 'cb4d6634' },
          tableName: 'organization_units',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND current_setting('vops.operations', true) = 'true' AND current_setting('vops.all_regions', true) = 'true'",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'organization_units',
        policy: {
          naming: { kind: 'wire', prefix: 'unit_read', hash: '3835b6e7' },
          tableName: 'organization_units',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using: "organization_id = nullif(current_setting('vops.organization_id', true), '')",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'skills',
        policy: {
          naming: { kind: 'wire', prefix: 'skills_insert', hash: 'a6f950fa' },
          tableName: 'skills',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR false)",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'skills',
        policy: {
          naming: { kind: 'wire', prefix: 'skills_select', hash: 'bb404630' },
          tableName: 'skills',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR true)",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'skills',
        policy: {
          naming: { kind: 'wire', prefix: 'skills_update', hash: '1d05c47d' },
          tableName: 'skills',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR false)",
          withCheck:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR false)",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'telemetry_pings',
        policy: {
          naming: { kind: 'wire', prefix: 'telemetry_pings_insert', hash: '9009e5e0' },
          tableName: 'telemetry_pings',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR EXISTS (SELECT 1 FROM public.volunteers v WHERE v.id = telemetry_pings.volunteer_id AND v.organization_id = telemetry_pings.organization_id AND v.user_id = nullif(current_setting('vops.user_id', true), '')::integer))",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'telemetry_pings',
        policy: {
          naming: { kind: 'wire', prefix: 'telemetry_pings_select', hash: '53f51863' },
          tableName: 'telemetry_pings',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR EXISTS (SELECT 1 FROM public.volunteers v WHERE v.id = telemetry_pings.volunteer_id AND v.organization_id = telemetry_pings.organization_id AND v.user_id = nullif(current_setting('vops.user_id', true), '')::integer))",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'telemetry_pings',
        policy: {
          naming: { kind: 'wire', prefix: 'telemetry_pings_update', hash: '89a79277' },
          tableName: 'telemetry_pings',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR EXISTS (SELECT 1 FROM public.volunteers v WHERE v.id = telemetry_pings.volunteer_id AND v.organization_id = telemetry_pings.organization_id AND v.user_id = nullif(current_setting('vops.user_id', true), '')::integer))",
          withCheck:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR EXISTS (SELECT 1 FROM public.volunteers v WHERE v.id = telemetry_pings.volunteer_id AND v.organization_id = telemetry_pings.organization_id AND v.user_id = nullif(current_setting('vops.user_id', true), '')::integer))",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'volunteer_skills',
        policy: {
          naming: { kind: 'wire', prefix: 'volunteer_skills_insert', hash: 'eda6dcb3' },
          tableName: 'volunteer_skills',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR EXISTS (SELECT 1 FROM public.volunteers v WHERE v.id = volunteer_skills.volunteer_id AND v.organization_id = volunteer_skills.organization_id AND v.user_id = nullif(current_setting('vops.user_id', true), '')::integer))",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'volunteer_skills',
        policy: {
          naming: { kind: 'wire', prefix: 'volunteer_skills_select', hash: '1d03706d' },
          tableName: 'volunteer_skills',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR EXISTS (SELECT 1 FROM public.volunteers v WHERE v.id = volunteer_skills.volunteer_id AND v.organization_id = volunteer_skills.organization_id AND v.user_id = nullif(current_setting('vops.user_id', true), '')::integer))",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'volunteer_skills',
        policy: {
          naming: { kind: 'wire', prefix: 'volunteer_skills_update', hash: '36824a5b' },
          tableName: 'volunteer_skills',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR EXISTS (SELECT 1 FROM public.volunteers v WHERE v.id = volunteer_skills.volunteer_id AND v.organization_id = volunteer_skills.organization_id AND v.user_id = nullif(current_setting('vops.user_id', true), '')::integer))",
          withCheck:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR EXISTS (SELECT 1 FROM public.volunteers v WHERE v.id = volunteer_skills.volunteer_id AND v.organization_id = volunteer_skills.organization_id AND v.user_id = nullif(current_setting('vops.user_id', true), '')::integer))",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'volunteers',
        policy: {
          naming: { kind: 'wire', prefix: 'volunteers_insert', hash: '7f002217' },
          tableName: 'volunteers',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR user_id = nullif(current_setting('vops.user_id', true), '')::integer)",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'volunteers',
        policy: {
          naming: { kind: 'wire', prefix: 'volunteers_select', hash: '385104ec' },
          tableName: 'volunteers',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR user_id = nullif(current_setting('vops.user_id', true), '')::integer)",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'volunteers',
        policy: {
          naming: { kind: 'wire', prefix: 'volunteers_update', hash: '83da7e4e' },
          tableName: 'volunteers',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR user_id = nullif(current_setting('vops.user_id', true), '')::integer)",
          withCheck:
            "organization_id = nullif(current_setting('vops.organization_id', true), '') AND (current_setting('vops.all_regions', true) = 'true' OR region_id = nullif(current_setting('vops.region_id', true), '')) AND (current_setting('vops.operations', true) = 'true' OR user_id = nullif(current_setting('vops.user_id', true), '')::integer)",
          permissive: true,
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
