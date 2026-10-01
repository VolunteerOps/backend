#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/24fd3be1dfd8b3d9c19cb4d6e3c57198ea998f5041d3fa6e50601ea539f85210/contract';
import endContract from '../../snapshots/24fd3be1dfd8b3d9c19cb4d6e3c57198ea998f5041d3fa6e50601ea539f85210/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/c843f4230dd60338ed8e0a86d01d45ebb6afdc04d4623049e38d1d4ea8aeec63/contract';
import startContract from '../../snapshots/c843f4230dd60338ed8e0a86d01d45ebb6afdc04d4623049e38d1d4ea8aeec63/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'responder_reservations',
        columns: [
          col('expires_at', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-temporal@1', typeParams: { precision: 3 } },
          }),
          col('organization_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('resource_reference', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('user_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['user_id'])],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'responder_reservations',
        foreignKey: {
          name: 'responder_reservations_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'responder_reservations',
        foreignKey: {
          name: 'responder_reservations_organization_id_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'responder_reservations' }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'responder_reservations',
        policy: {
          naming: { kind: 'wire', prefix: 'responder_reservation_read', hash: '3e238f38' },
          tableName: 'responder_reservations',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "user_id = nullif(current_setting('vops.user_id', true), '')::integer OR organization_id = current_setting('vops.organization_id', true)",
          permissive: true,
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
