import { Controller, Get, Inject } from '@nestjs/common';
import { MarketService } from './market.service';
import type { MarketOverview } from './market.types';

@Controller('market')
export class MarketController {
  constructor(@Inject(MarketService) private readonly market: MarketService) {}

  @Get('overview')
  overview(): Promise<MarketOverview> {
    return this.market.overview();
  }
}
