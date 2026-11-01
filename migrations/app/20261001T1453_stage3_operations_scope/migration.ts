#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/5c4b6aadc3db74c9fef4369f5c974226d9c3a957ee08a4932d325b3dd74340a4/contract';
import endContract from '../../snapshots/5c4b6aadc3db74c9fef4369f5c974226d9c3a957ee08a4932d325b3dd74340a4/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/787f4659367360d2708bbad749edac72102f408ee1c226f34a3d33f30786f0d3/contract';
import startContract from '../../snapshots/787f4659367360d2708bbad749edac72102f408ee1c226f34a3d33f30786f0d3/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addForeignKey({
        schema: 'public',
        table: 'operation_receipts',
        foreignKey: {
          name: 'operation_receipts_organization_id_region_id_fkey',
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
        table: 'operation_receipts',
        foreignKey: {
          name: 'operation_receipts_organization_id_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'operation_receipts',
        foreignKey: {
          name: 'operation_receipts_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'operation_records',
        foreignKey: {
          name: 'operation_records_organization_id_region_id_fkey',
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
        table: 'operation_records',
        foreignKey: {
          name: 'operation_records_organization_id_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'operation_records',
        foreignKey: {
          name: 'operation_records_owner_id_fkey',
          columns: ['owner_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'operation_receipts',
        policy: {
          naming: { kind: 'wire', prefix: 'ops_receipt_insert', hash: '41861ccb' },
          tableName: 'operation_receipts',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck:
            "user_id=nullif(current_setting('vops.user_id',true),'')::integer AND organization_id=current_setting('vops.organization_id',true) AND region_id=current_setting('vops.region_id',true)",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'operation_receipts',
        policy: {
          naming: { kind: 'wire', prefix: 'ops_receipt_owner', hash: 'eb9ee7c4' },
          tableName: 'operation_receipts',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using: "user_id=nullif(current_setting('vops.user_id',true),'')::integer",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'operation_records',
        policy: {
          naming: { kind: 'wire', prefix: 'operations_insert', hash: '37f73d5f' },
          tableName: 'operation_records',
          namespaceId: 'public',
          operation: 'insert',
          roles: [],
          withCheck:
            "organization_id=current_setting('vops.organization_id',true) AND region_id=current_setting('vops.region_id',true) AND current_setting('vops.operations',true)='true'",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'operation_records',
        policy: {
          naming: { kind: 'wire', prefix: 'operations_scope', hash: 'ef3bd367' },
          tableName: 'operation_records',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "organization_id = current_setting('vops.organization_id',true) AND region_id = current_setting('vops.region_id',true) AND (kind NOT IN ('APPLICATION','ASSIGNMENT','HOURS','SUPPORT') OR owner_id = nullif(current_setting('vops.user_id',true),'')::integer OR EXISTS(SELECT 1 FROM public.organization_memberships m WHERE m.organization_id=operation_records.organization_id AND m.user_id=nullif(current_setting('vops.user_id',true),'')::integer AND m.status='ACTIVE' AND m.role IN ('ORG_ADMIN','COORDINATOR')))",
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'operation_records',
        policy: {
          naming: { kind: 'wire', prefix: 'operations_update', hash: '0e7cfbda' },
          tableName: 'operation_records',
          namespaceId: 'public',
          operation: 'update',
          roles: [],
          using:
            "organization_id=current_setting('vops.organization_id',true) AND region_id=current_setting('vops.region_id',true) AND current_setting('vops.operations',true)='true'",
          withCheck:
            "organization_id=current_setting('vops.organization_id',true) AND region_id=current_setting('vops.region_id',true)",
          permissive: true,
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
