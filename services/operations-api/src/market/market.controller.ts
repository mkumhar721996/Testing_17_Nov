import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { SignedInGuard } from '../auth/hr.guard';
import { MarketService } from './market.service';
import type { MarketOverview } from './market.types';

@Controller('market')
export class MarketController {
  constructor(@Inject(MarketService) private readonly market: MarketService) {}

  @Get('overview')
  @UseGuards(SignedInGuard)
  overview(): Promise<MarketOverview> {
    return this.market.overview();
  }
}
