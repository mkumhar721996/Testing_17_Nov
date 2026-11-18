import { Controller, Get, Inject, Param, ParseEnumPipe, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { DashboardService } from './dashboard.service';
import { ChartRange } from './sample-data';

const RANGES: ChartRange[] = ['1m', '1y', 'all'];
const rangePipe = new ParseEnumPipe(Object.fromEntries(RANGES.map((r) => [r, r])));

@Controller('dashboard')
@UseGuards(AuthGuard)
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly dashboard: DashboardService) {}

  @Get('portfolio')
  portfolio() {
    return this.dashboard.getPortfolio();
  }

  @Get('charts/growth')
  growth(@Query('range', rangePipe) range: ChartRange) {
    return { range, points: this.dashboard.getGrowth(range) };
  }

  @Get('charts/returns')
  returns(@Query('range', rangePipe) range: ChartRange) {
    return { range, points: this.dashboard.getReturns(range) };
  }

  @Get('charts/allocation')
  allocation() {
    return this.dashboard.getAllocation();
  }

  @Get('sips')
  sips() {
    return this.dashboard.listSips();
  }

  @Get('market-movers')
  marketMovers() {
    return this.dashboard.getMarketMovers();
  }

  @Get('ipos')
  ipos() {
    return this.dashboard.listOpenIpos();
  }

  @Get('ipos/:id')
  ipo(@Param('id') id: string) {
    return this.dashboard.getIpo(id);
  }
}
