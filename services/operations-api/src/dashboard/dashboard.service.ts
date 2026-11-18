import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ALLOCATION,
  ChartRange,
  GROWTH,
  IPOS,
  Ipo,
  MARKET_MOVERS,
  Mover,
  PORTFOLIO,
  PortfolioSummary,
  RETURNS,
  SIPS,
  SeriesPoint,
  Sip,
} from './sample-data';

@Injectable()
export class DashboardService {
  getPortfolio(): PortfolioSummary {
    return PORTFOLIO;
  }

  getGrowth(range: ChartRange): SeriesPoint[] {
    return GROWTH[range];
  }

  getReturns(range: ChartRange): SeriesPoint[] {
    return RETURNS[range];
  }

  getAllocation(): { asOf: string; slices: { asset: string; pct: number }[] } {
    return ALLOCATION;
  }

  listSips(): Sip[] {
    return SIPS;
  }

  getMarketMovers(): { gainers: Mover[]; losers: Mover[] } {
    return MARKET_MOVERS;
  }

  listOpenIpos(): Ipo[] {
    return IPOS.filter((i) => i.status === 'open');
  }

  getIpo(id: string): Ipo {
    const ipo = this.listOpenIpos().find((i) => i.id === id);
    if (!ipo) throw new NotFoundException(`IPO ${id} is not open for application`);
    return ipo;
  }
}
