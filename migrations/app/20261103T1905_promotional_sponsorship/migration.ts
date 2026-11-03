#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/71810e86fd033f4327c1d7cc0ec45826c8994a030015b5ed470b968b58b4b3d3/contract';
import startContract from '../../snapshots/71810e86fd033f4327c1d7cc0ec45826c8994a030015b5ed470b968b58b4b3d3/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/c5b6078f3f258d50f0fd9100bdd2d7e5feed57d6c6962c82cde59c20dc4c371d/contract';
import endContract from '../../snapshots/c5b6078f3f258d50f0fd9100bdd2d7e5feed57d6c6962c82cde59c20dc4c371d/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createRlsPolicy({
        schema: 'public',
        table: 'promo_redemptions',
        policy: {
          naming: { kind: 'wire', prefix: 'promo_sponsored_access', hash: 'e06cf260' },
          tableName: 'promo_redemptions',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using:
            "EXISTS (SELECT 1 FROM public.pro_sponsorships s WHERE s.sponsor_id=promo_redemptions.user_id AND s.user_id=nullif(current_setting('vops.user_id',true),'')::integer AND s.organization_id=current_setting('vops.organization_id',true) AND s.active)",
          permissive: true,
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
