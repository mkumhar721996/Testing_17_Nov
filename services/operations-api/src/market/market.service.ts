import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import type { MarketOverview } from './market.types';

@Injectable()
export class MarketService {
  constructor(@Inject(PG_POOL) private readonly pool: Pick<Pool, 'query'>) {}

  /** Reads the latest snapshot the Background Worker stored; never calls the vendor (ADR-0003). */
  async overview(): Promise<MarketOverview> {
    const { rows } = await this.pool.query<{ payload: MarketOverview }>(
      'SELECT payload FROM market_snapshot WHERE id = 1',
    );
    if (rows.length === 0) {
      throw new ServiceUnavailableException({ error: 'market data unavailable' });
    }
    return rows[0].payload;
  }
}
