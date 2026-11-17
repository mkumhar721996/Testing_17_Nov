import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { DashboardService } from './dashboard.service';
import { CHART_RANGES, type ChartRange } from './dashboard.types';

const parseRange = (range?: string): ChartRange => {
  if (!CHART_RANGES.includes(range as ChartRange)) {
    throw new BadRequestException(`range must be one of ${CHART_RANGES.join(', ')}`);
  }
  return range as ChartRange;
};

@Controller('dashboard')
@UseGuards(AuthGuard)
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly service: DashboardService) {}

  @Get('portfolio')
  portfolio() {
    return this.service.portfolio();
  }

  @Get('charts/growth')
  growth(@Query('range') range?: string) {
    return this.service.growth(parseRange(range));
  }

  @Get('charts/returns')
  returns(@Query('range') range?: string) {
    return this.service.returns(parseRange(range));
  }

  @Get('charts/allocation')
  allocation() {
    return this.service.allocation();
  }

  @Get('sips')
  sips() {
    return this.service.sips();
  }

  @Get('market-movers')
  marketMovers() {
    return this.service.marketMovers();
  }

  @Get('ipos')
  ipos() {
    return this.service.openIpos();
  }

  @Get('ipos/:id')
  ipo(@Param('id') id: string) {
    return this.service.ipoDetail(id);
  }
}
