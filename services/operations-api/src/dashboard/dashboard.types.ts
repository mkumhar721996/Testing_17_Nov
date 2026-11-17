export type ChartRange = '1M' | '1Y' | 'All';
export const CHART_RANGES: readonly ChartRange[] = ['1M', '1Y', 'All'];

export interface SeriesPoint {
  date: string;
  value: number;
}

export interface PortfolioSummary {
  portfolioValue: number;
  investedAmount: number;
  returns: number;
  returnsPercent: number;
  nextSip: { date: string; amount: number };
}

export interface AllocationSlice {
  assetClass: string;
  percent: number;
  value: number;
}

export interface Sip {
  id: string;
  investorId: string;
  fundName: string;
  amount: number;
  nextDate: string;
  status: 'Active' | 'Paused';
}

export interface Mover {
  symbol: string;
  name: string;
  changePercent: number;
}

export interface Ipo {
  id: string;
  name: string;
  sector: string;
  status: 'open' | 'upcoming' | 'closed';
  priceBandLow: number;
  priceBandHigh: number;
  lotSize: number;
  opensOn: string;
  closesOn: string;
  issueSizeCrore: number;
  allotmentOn: string;
  listing: string;
  minInvestment: number;
}
