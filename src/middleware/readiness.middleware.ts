import type { Request, Response } from 'express';
import { assessDatabaseReadiness, type DatabaseFacts } from '../core/database-readiness.js';

export function createDatabaseReadinessHandler(load: () => Promise<DatabaseFacts>, requireTls: boolean) {
  return async (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const result = assessDatabaseReadiness(await load(), requireTls);
      res.status(result.ready ? 200 : 503).json({
        ok: result.ready,
        scope: 'database_prerequisites',
        blockers: result.blockers,
      });
    } catch {
      res.status(503).json({ ok: false, scope: 'database_prerequisites', blockers: ['DATABASE_UNAVAILABLE'] });
    }
  };
}