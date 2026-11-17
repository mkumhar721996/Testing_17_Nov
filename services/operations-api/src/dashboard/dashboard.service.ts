import { Injectable, NotFoundException } from '@nestjs/common';
import type { ChartRange } from './dashboard.types';
import * as data from './sample-data';

const today = () => new Date().toISOString().slice(0, 10);

@Injectable()
export class DashboardService {
  portfolio() {
    return { investorId: data.INVESTOR_ID, summary: data.portfolioSummary };
  }

  growth(range: ChartRange) {
    return { range, series: data.growthFor(range) };
  }

  returns(range: ChartRange) {
    return { range, series: data.returnsFor(range) };
  }

  allocation() {
    return { asOf: today(), slices: data.allocationSlices };
  }

  sips() {
    return { investorId: data.INVESTOR_ID, sips: data.sips };
  }

  marketMovers() {
    return { asOf: today(), gainers: data.gainers, losers: data.losers };
  }

  openIpos() {
    return { ipos: data.ipos.filter((i) => i.status === 'open') };
  }

  ipoDetail(id: string) {
    const ipo = data.ipos.find((i) => i.id === id);
    if (!ipo) throw new NotFoundException(`IPO ${id} not found`);
    return ipo;
  }
}
