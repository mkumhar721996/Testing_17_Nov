import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { ApiError } from '../common/api-error';
import { PG_POOL } from '../database/database.module';
import type { MarketOverview } from './market.types';

@Injectable()
export class MarketService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** The latest snapshot stored by the Background Worker; 503 until its first successful sync. */
  async overview(): Promise<MarketOverview> {
    const { rows } = await this.pool.query<{ payload: MarketOverview }>('select payload from market_snapshot where id = 1');
    if (rows.length === 0) throw new ApiError(503, 'MARKET_DATA_UNAVAILABLE', 'Market data is not available yet');
    return rows[0].payload;
  }
}
