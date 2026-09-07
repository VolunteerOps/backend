#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/46d8f4daada32a8ad350a5904b9e8adc549a652b142707850575d37137d36ff5/contract';
import endContract from '../../snapshots/46d8f4daada32a8ad350a5904b9e8adc549a652b142707850575d37137d36ff5/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createNativeEnumType({
        schema: 'public',
        typeName: 'ContactStatus',
        members: ['NEW', 'IN_REVIEW', 'RESPONDED', 'RESOLVED', 'ARCHIVED'],
      }),
      this.createNativeEnumType({
        schema: 'public',
        typeName: 'DeploymentStatus',
        members: ['ASSIGNED', 'EN_ROUTE', 'ON_SITE', 'CHECKED_IN', 'COMPLETED', 'CANCELLED'],
      }),
      this.createNativeEnumType({
        schema: 'public',
        typeName: 'MissionPriority',
        members: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
      }),
      this.createNativeEnumType({
        schema: 'public',
        typeName: 'MissionStatus',
        members: ['STAGED', 'ACTIVE', 'CONTAINED', 'COMPLETED', 'CANCELLED'],
      }),
      this.createNativeEnumType({
        schema: 'public',
        typeName: 'UserRole',
        members: ['SUPER_ADMIN', 'COORDINATOR', 'TEAM_LEAD', 'VOLUNTEER'],
      }),
      this.createNativeEnumType({
        schema: 'public',
        typeName: 'VolunteerStatus',
        members: ['ACTIVE', 'DEPLOYED', 'AVAILABLE', 'RESTRICTED', 'INACTIVE'],
      }),
      this.createTable({
        schema: 'public',
        table: 'audit_logs',
        columns: [
          col('action', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('entity_id', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('entity_type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('ip_address', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('new_values', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
          col('old_values', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
          col('user_agent', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('user_id', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'], { name: 'audit_logs_pkey' })],
      }),
      this.createTable({
        schema: 'public',
        table: 'communications',
        columns: [
          col('channel_id', 'text', {
            notNull: true,
            default: lit('general'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('event_id', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('media_url', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('message', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('message_type', 'text', {
            notNull: true,
            default: lit('text'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('priority', 'text', {
            notNull: true,
            default: lit('normal'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('sender_id', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('sender_name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sender_role', 'text', {
            notNull: true,
            default: lit('coordinator'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [primaryKey(['id'], { name: 'communications_pkey' })],
      }),
      this.createTable({
        schema: 'public',
        table: 'contact_submissions',
        columns: [
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('inquiry_type', 'text', {
            notNull: true,
            default: lit('general'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('ip_address', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('message', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organization', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('response_notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('status', '"ContactStatus"', {
            notNull: true,
            default: lit('NEW'),
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'ContactStatus' } },
          }),
          col('subject', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updated_at', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'], { name: 'contact_submissions_pkey' })],
      }),
      this.createTable({
        schema: 'public',
        table: 'deployments',
        columns: [
          col('assigned_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('assigned_by', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('check_in_latitude', 'numeric(10,7)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 7 } },
          }),
          col('check_in_longitude', 'numeric(10,7)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 7 } },
          }),
          col('check_in_method', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('check_in_time', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('completed_at', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('event_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('status', '"DeploymentStatus"', {
            notNull: true,
            default: lit('ASSIGNED'),
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'DeploymentStatus' } },
          }),
          col('updated_at', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('volunteer_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'], { name: 'deployments_pkey' })],
      }),
      this.createTable({
        schema: 'public',
        table: 'dispatch_jobs',
        columns: [
          col('attempts', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('job_type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('last_error', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('locked_at', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('locked_by', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('max_attempts', 'int4', {
            notNull: true,
            default: lit(3),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('payload', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('priority', 'int4', {
            notNull: true,
            default: lit(10),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('processed_at', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [primaryKey(['id'], { name: 'dispatch_jobs_pkey' })],
      }),
      this.createTable({
        schema: 'public',
        table: 'events',
        columns: [
          col('coordinator_id', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('coordinator_name', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('end_date', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('event_name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('event_type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('location_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('priority', '"MissionPriority"', {
            notNull: true,
            default: lit('MEDIUM'),
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'MissionPriority' } },
          }),
          col('required_skills', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
          col('required_volunteers', 'int4', {
            notNull: true,
            default: lit(10),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('start_date', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('status', '"MissionStatus"', {
            notNull: true,
            default: lit('ACTIVE'),
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'MissionStatus' } },
          }),
          col('tags', 'text[]', {
            notNull: true,
            default: lit([]),
            codecRef: { codecId: 'pg/text@1', many: true },
          }),
          col('updated_at', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'], { name: 'events_pkey' })],
      }),
      this.createTable({
        schema: 'public',
        table: 'feedback',
        columns: [
          col('comments', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('deployment_id', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('event_id', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('feedback_time', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('rating', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('submitted_via', 'text', {
            notNull: true,
            default: lit('mobile_app'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('volunteer_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'], { name: 'feedback_pkey' })],
      }),
      this.createTable({
        schema: 'public',
        table: 'field_reports',
        columns: [
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('deployment_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('file_upload_url', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('latitude', 'numeric(10,7)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 7 } },
          }),
          col('longitude', 'numeric(10,7)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 7 } },
          }),
          col('media_url', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('priority', 'text', {
            notNull: true,
            default: lit('medium'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('report_time', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('report_type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('submitted'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('submitted_via', 'text', {
            notNull: true,
            default: lit('mobile_app'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('text_response', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('verified_by', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'], { name: 'field_reports_pkey' })],
      }),
      this.createTable({
        schema: 'public',
        table: 'locations',
        columns: [
          col('address', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('city', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('country', 'text', { default: lit('USA'), codecRef: { codecId: 'pg/text@1' } }),
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('hazard_level', 'text', {
            notNull: true,
            default: lit('low'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('latitude', 'numeric(10,7)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 7 } },
          }),
          col('longitude', 'numeric(10,7)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 7 } },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('osm_id', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('radius_meters', 'int4', {
            notNull: true,
            default: lit(5000),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('state', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'], { name: 'locations_pkey' })],
      }),
      this.createTable({
        schema: 'public',
        table: 'notifications',
        columns: [
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('event_id', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('message', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notification_type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('priority', 'text', {
            notNull: true,
            default: lit('normal'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('read_at', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('sent_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('sent_by', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('sent'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('title', 'text', {
            notNull: true,
            default: lit('Operational Alert'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('volunteer_id', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'], { name: 'notifications_pkey' })],
      }),
      this.createTable({
        schema: 'public',
        table: 'refresh_tokens',
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
          col('family', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('ip_address', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('is_revoked', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('token_hash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updated_at', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('user_agent', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('user_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'], { name: 'refresh_tokens_pkey' })],
      }),
      this.createTable({
        schema: 'public',
        table: 'skills',
        columns: [
          col('category', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('demand_level', 'text', {
            notNull: true,
            default: lit('medium'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('skill_name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'], { name: 'skills_pkey' })],
      }),
      this.createTable({
        schema: 'public',
        table: 'telemetry_pings',
        columns: [
          col('altitude', 'numeric(8,2)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 8, scale: 2 } },
          }),
          col('battery_level', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('heading', 'numeric(5,2)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 5, scale: 2 } },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('is_distress', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('latitude', 'numeric(10,7)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 7 } },
          }),
          col('longitude', 'numeric(10,7)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 7 } },
          }),
          col('recorded_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('speed', 'numeric(6,2)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 6, scale: 2 } },
          }),
          col('volunteer_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'], { name: 'telemetry_pings_pkey' })],
      }),
      this.createTable({
        schema: 'public',
        table: 'users',
        columns: [
          col('avatar_url', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('full_name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('is_active', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('last_login_at', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('password_hash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('phone_number', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('role', '"UserRole"', {
            notNull: true,
            default: lit('VOLUNTEER'),
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'UserRole' } },
          }),
          col('updated_at', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'], { name: 'users_pkey' })],
      }),
      this.createTable({
        schema: 'public',
        table: 'volunteer_skills',
        columns: [
          col('certification_date', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('certified_by', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('is_certified', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('proficiency_level', 'text', {
            notNull: true,
            default: lit('intermediate'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('skill_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('volunteer_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'], { name: 'volunteer_skills_pkey' })],
      }),
      this.createTable({
        schema: 'public',
        table: 'volunteers',
        columns: [
          col('address', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('availability_schedule', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
          col('avatar_url', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('badge_count', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('bio', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('consent_given', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('date_of_birth', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('emergency_contact', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('full_name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('latitude', 'numeric(10,7)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 7 } },
          }),
          col('longitude', 'numeric(10,7)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 7 } },
          }),
          col('phone_number', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('registration_channel', 'text', {
            notNull: true,
            default: lit('inbuilt'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('registration_date', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('status', '"VolunteerStatus"', {
            notNull: true,
            default: lit('AVAILABLE'),
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'VolunteerStatus' } },
          }),
          col('total_hours', 'numeric(10,2)', {
            notNull: true,
            default: fn("'0'::numeric(10,2)"),
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 2 } },
          }),
          col('updated_at', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('user_id', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'], { name: 'volunteers_pkey' })],
      }),
      this.addUnique({
        schema: 'public',
        table: 'volunteers',
        constraint: 'volunteers_user_id_key',
        columns: ['user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'audit_logs',
        index: 'idx_audit_entity',
        columns: ['entity_type', 'entity_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'communications',
        index: 'idx_communications_channel',
        columns: ['channel_id', 'created_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'contact_submissions',
        index: 'idx_contact_status',
        columns: ['status', 'created_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'deployments',
        index: 'idx_deployments_status',
        columns: ['status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'deployments',
        index: 'idx_deployments_volunteer_event',
        columns: ['volunteer_id', 'event_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'dispatch_jobs',
        index: 'idx_dispatch_jobs_queue',
        columns: ['status', 'priority', 'created_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'events',
        index: 'idx_events_status_priority',
        columns: ['status', 'priority'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'field_reports',
        index: 'idx_field_reports_type_status',
        columns: ['report_type', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'locations',
        index: 'idx_locations_coords',
        columns: ['latitude', 'longitude'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'notifications',
        index: 'idx_notifications_volunteer',
        columns: ['volunteer_id', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'refresh_tokens',
        index: 'idx_refresh_tokens_family',
        columns: ['family'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'refresh_tokens',
        index: 'idx_refresh_tokens_hash',
        columns: ['token_hash'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'refresh_tokens',
        index: 'idx_refresh_tokens_user',
        columns: ['user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'refresh_tokens',
        index: 'refresh_tokens_token_hash_key',
        columns: ['token_hash'],
        extras: { unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'skills',
        index: 'idx_skills_category',
        columns: ['category'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'skills',
        index: 'skills_skill_name_key',
        columns: ['skill_name'],
        extras: { unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'telemetry_pings',
        index: 'idx_telemetry_volunteer_time',
        columns: ['volunteer_id', 'recorded_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'users',
        index: 'users_email_key',
        columns: ['email'],
        extras: { unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'volunteer_skills',
        index: 'volunteer_skills_volunteer_id_skill_id_key',
        columns: ['volunteer_id', 'skill_id'],
        extras: { unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'volunteers',
        index: 'idx_volunteers_geo',
        columns: ['latitude', 'longitude'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'volunteers',
        index: 'idx_volunteers_status',
        columns: ['status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'volunteers',
        index: 'volunteers_email_key',
        columns: ['email'],
        extras: { unique: true },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'audit_logs',
        foreignKey: {
          name: 'audit_logs_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'communications',
        foreignKey: {
          name: 'communications_event_id_fkey',
          columns: ['event_id'],
          references: { schema: 'public', table: 'events', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'deployments',
        foreignKey: {
          name: 'deployments_event_id_fkey',
          columns: ['event_id'],
          references: { schema: 'public', table: 'events', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'deployments',
        foreignKey: {
          name: 'deployments_volunteer_id_fkey',
          columns: ['volunteer_id'],
          references: { schema: 'public', table: 'volunteers', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'events',
        foreignKey: {
          name: 'events_location_id_fkey',
          columns: ['location_id'],
          references: { schema: 'public', table: 'locations', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'feedback',
        foreignKey: {
          name: 'feedback_deployment_id_fkey',
          columns: ['deployment_id'],
          references: { schema: 'public', table: 'deployments', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'feedback',
        foreignKey: {
          name: 'feedback_event_id_fkey',
          columns: ['event_id'],
          references: { schema: 'public', table: 'events', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'feedback',
        foreignKey: {
          name: 'feedback_volunteer_id_fkey',
          columns: ['volunteer_id'],
          references: { schema: 'public', table: 'volunteers', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'field_reports',
        foreignKey: {
          name: 'field_reports_deployment_id_fkey',
          columns: ['deployment_id'],
          references: { schema: 'public', table: 'deployments', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'notifications',
        foreignKey: {
          name: 'notifications_event_id_fkey',
          columns: ['event_id'],
          references: { schema: 'public', table: 'events', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'notifications',
        foreignKey: {
          name: 'notifications_volunteer_id_fkey',
          columns: ['volunteer_id'],
          references: { schema: 'public', table: 'volunteers', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'refresh_tokens',
        foreignKey: {
          name: 'refresh_tokens_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'telemetry_pings',
        foreignKey: {
          name: 'telemetry_pings_volunteer_id_fkey',
          columns: ['volunteer_id'],
          references: { schema: 'public', table: 'volunteers', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'volunteer_skills',
        foreignKey: {
          name: 'volunteer_skills_skill_id_fkey',
          columns: ['skill_id'],
          references: { schema: 'public', table: 'skills', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'volunteer_skills',
        foreignKey: {
          name: 'volunteer_skills_volunteer_id_fkey',
          columns: ['volunteer_id'],
          references: { schema: 'public', table: 'volunteers', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'volunteers',
        foreignKey: {
          name: 'volunteers_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
