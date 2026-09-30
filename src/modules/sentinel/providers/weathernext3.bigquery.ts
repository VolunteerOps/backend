import { BigQuery } from '@google-cloud/bigquery';
import { z } from 'zod';
import { boundsSchema, boundsWkt, forecastHorizon, forecastVariables, normalizeForecastRow, statistics, type Bounds, type ForecastCell } from './weathernext3.contract.js';

const configSchema = z.object({
  projectId: z.string().regex(/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/),
  datasetId: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,1023}$/),
  location: z.string().regex(/^[A-Za-z0-9-]{2,40}$/).default('US'),
  maximumBytesBilled: z.number().int().positive().max(10_000_000_000),
  maxRows: z.number().int().min(1).max(20000).default(10000),
});
export type WeatherNextConfig = z.infer<typeof configSchema>;
export interface ForecastRequest { initTime: string; fromHour: number; toHour: number; bounds: Bounds }
export interface ForecastBatch {
  source: 'WEATHERNEXT_3'; model: 'weathernext_3_0_0'; surface: 'BIGQUERY'; resolutionDegrees: 0.1;
  initTime: string; retrievedAt: string; cells: ForecastCell[]; jobId: string;
}
export function buildForecastQuery(input: WeatherNextConfig, request: ForecastRequest) {
  const config = configSchema.parse(input), bounds = boundsSchema.parse(request.bounds);
  const horizon = forecastHorizon(request.initTime);
  if (!Number.isInteger(request.fromHour) || !Number.isInteger(request.toHour) ||
      request.fromHour < 1 || request.toHour < request.fromHour || request.toHour > horizon ||
      request.toHour - request.fromHour > 47) throw new Error('INVALID_FORECAST_WINDOW');
  const width = bounds.west < bounds.east ? bounds.east - bounds.west : 360 - bounds.west + bounds.east;
  if (width * (bounds.north - bounds.south) > 25) throw new Error('FORECAST_REGION_REQUIRES_TILING');
  const columns = Object.keys(forecastVariables).flatMap(variable => statistics.map(stat => 'f.' + variable + '_' + stat));
  return {
    query: `SELECT t.init_time, f.time AS valid_time, f.hours AS lead_hours,
      ST_X(t.geography) AS longitude, ST_Y(t.geography) AS latitude,
      ${columns.join(', ')}
      FROM \`${config.projectId}.${config.datasetId}.weathernext_3_0_0_0p1deg\` AS t,
      UNNEST(t.forecast) AS f
      WHERE t.init_time = @init_time
        AND ST_INTERSECTS(t.geography, ST_GEOGFROMTEXT(@region))
        AND f.hours BETWEEN @from_hour AND @to_hour
      ORDER BY f.time, longitude, latitude LIMIT @row_limit`,
    params: { init_time: new Date(request.initTime), region: boundsWkt(bounds),
      from_hour: request.fromHour, to_hour: request.toHour, row_limit: config.maxRows + 1 },
    maximumBytesBilled: String(config.maximumBytesBilled), location: config.location,
    useLegacySql: false, jobTimeoutMs: 120000,
  };
}
export class WeatherNext3BigQuery {
  private readonly config: WeatherNextConfig;
  private readonly client: BigQuery;
  constructor(config: WeatherNextConfig, client?: BigQuery) {
    this.config = configSchema.parse(config);
    this.client = client ?? new BigQuery({ projectId: config.projectId, maxRetries: 2 });
  }
  async fetch(request: ForecastRequest, signal: AbortSignal): Promise<ForecastBatch> {
    signal.throwIfAborted();
    const [job] = await this.client.createQueryJob(buildForecastQuery(this.config, request));
    const cancel = () => { void job.cancel().catch(() => {}); };
    signal.addEventListener('abort', cancel, { once: true });
    try {
      signal.throwIfAborted();
      const [rows, next] = await job.getQueryResults({ autoPaginate: false, maxResults: this.config.maxRows + 1, timeoutMs: 20000 });
      signal.throwIfAborted();
      if (next || rows.length > this.config.maxRows) throw new Error('FORECAST_RESULT_REQUIRES_TILING');
      if (!rows.length) throw new Error('FORECAST_RUN_UNAVAILABLE');
      const cells = rows.map(row => normalizeForecastRow(row, request.initTime, request.bounds));
      const keys = new Set(cells.map(c => JSON.stringify([c.longitude, c.latitude, c.validTime])));
      if (keys.size !== cells.length) throw new Error('DUPLICATE_FORECAST_CELL');
      if (cells.some(c => c.leadHours < request.fromHour || c.leadHours > request.toHour)) throw new Error('FORECAST_WINDOW_MISMATCH');
      return { source: 'WEATHERNEXT_3', model: 'weathernext_3_0_0', surface: 'BIGQUERY', resolutionDegrees: 0.1,
        initTime: new Date(request.initTime).toISOString(), retrievedAt: new Date().toISOString(), cells, jobId: job.id! };
    } catch (error) { cancel(); throw error; }
    finally { signal.removeEventListener('abort', cancel); }
  }
}
