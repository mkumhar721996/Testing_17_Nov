// Placeholder data for the single sample investor. Dates are ISO strings, money is integer
// rupees, percentages are plain numbers; formatting is the screens' job.
export type ChartRange = '1m' | '1y' | 'all';

export interface PortfolioSummary {
  investorId: string;
  investorName: string;
  value: number;
  invested: number;
  returns: number;
  returnsPct: number;
  nextSip: { amount: number; date: string };
}
export interface SeriesPoint {
  date: string;
  value: number;
}
export interface Sip {
  id: string;
  investorId: string;
  fund: string;
  amount: number;
  nextDate: string;
  status: 'Active' | 'Paused';
}
export interface Mover {
  name: string;
  changePct: number;
}
export interface Ipo {
  id: string;
  name: string;
  sector: string;
  status: 'open' | 'closed' | 'upcoming';
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

const INVESTOR_ID = 'INV-0001';

export const PORTFOLIO: PortfolioSummary = {
  investorId: INVESTOR_ID,
  investorName: 'Meera Iyer',
  value: 482310,
  invested: 420000,
  returns: 62310,
  returnsPct: 14.8,
  nextSip: { amount: 5000, date: '2026-12-01' },
};

const points = (rows: [string, number][]): SeriesPoint[] => rows.map(([date, value]) => ({ date, value }));

export const GROWTH: Record<ChartRange, SeriesPoint[]> = {
  '1m': points([
    ['2026-10-17', 458000],
    ['2026-10-24', 465500],
    ['2026-10-31', 462000],
    ['2026-11-07', 471000],
    ['2026-11-12', 476500],
    ['2026-11-15', 479800],
    ['2026-11-17', 482310],
  ]),
  '1y': points([
    ['2025-11-17', 150000],
    ['2026-02-17', 235000],
    ['2026-05-17', 320000],
    ['2026-08-17', 405000],
    ['2026-11-17', 482310],
  ]),
  all: points([
    ['2022-01-17', 20000],
    ['2023-01-17', 110000],
    ['2024-06-17', 235000],
    ['2025-06-17', 340000],
    ['2026-11-17', 482310],
  ]),
};

export const RETURNS: Record<ChartRange, SeriesPoint[]> = {
  '1m': points([
    ['2026-10-17', 38000],
    ['2026-10-24', 45500],
    ['2026-10-31', 42000],
    ['2026-11-07', 51000],
    ['2026-11-12', 56500],
    ['2026-11-15', 59800],
    ['2026-11-17', 62310],
  ]),
  '1y': points([
    ['2025-11-17', 4000],
    ['2026-02-17', 18000],
    ['2026-05-17', 33000],
    ['2026-08-17', 49000],
    ['2026-11-17', 62310],
  ]),
  all: points([
    ['2022-01-17', 0],
    ['2023-01-17', 6000],
    ['2024-06-17', 21000],
    ['2025-06-17', 40000],
    ['2026-11-17', 62310],
  ]),
};

export const ALLOCATION = {
  asOf: '2026-11-17',
  slices: [
    { asset: 'Equity', pct: 55 },
    { asset: 'Debt', pct: 25 },
    { asset: 'Gold', pct: 12 },
    { asset: 'Cash', pct: 8 },
  ],
};

export const SIPS: Sip[] = [
  { id: 'sip-1', investorId: INVESTOR_ID, fund: 'Nifty 50 Index Fund', amount: 5000, nextDate: '2026-12-01', status: 'Active' },
  { id: 'sip-2', investorId: INVESTOR_ID, fund: 'Bluechip Equity Fund', amount: 3000, nextDate: '2026-12-05', status: 'Active' },
  { id: 'sip-3', investorId: INVESTOR_ID, fund: 'Midcap Growth Fund', amount: 2000, nextDate: '2026-12-10', status: 'Active' },
  { id: 'sip-4', investorId: INVESTOR_ID, fund: 'Gold ETF', amount: 1000, nextDate: '2026-12-15', status: 'Paused' },
];

export const MARKET_MOVERS: { gainers: Mover[]; losers: Mover[] } = {
  gainers: [
    { name: 'Tata Motors', changePct: 4.2 },
    { name: 'Infosys', changePct: 3.1 },
    { name: 'HDFC Bank', changePct: 2.6 },
  ],
  losers: [
    { name: 'Adani Ports', changePct: -3.4 },
    { name: 'Wipro', changePct: -2.9 },
    { name: 'Sun Pharma', changePct: -2.2 },
  ],
};

// `status` is fixed rather than derived from the clock so the sample stays deterministic.
// The closed and upcoming IPOs exist only to prove the open-only filter.
export const IPOS: Ipo[] = [
  {
    id: 'skyline',
    name: 'Skyline Logistics Ltd',
    sector: 'Logistics and warehousing',
    status: 'open',
    priceBandLow: 312,
    priceBandHigh: 328,
    lotSize: 45,
    opensOn: '2026-11-17',
    closesOn: '2026-11-20',
    issueSizeCrore: 1150,
    allotmentOn: '2026-11-25',
    listing: 'NSE and BSE',
    minInvestment: 14760,
  },
  {
    id: 'greenleaf',
    name: 'Greenleaf Foods Ltd',
    sector: 'Packaged foods',
    status: 'open',
    priceBandLow: 148,
    priceBandHigh: 156,
    lotSize: 96,
    opensOn: '2026-11-18',
    closesOn: '2026-11-23',
    issueSizeCrore: 640,
    allotmentOn: '2026-11-26',
    listing: 'NSE and BSE',
    minInvestment: 14976,
  },
  {
    id: 'harbor-closed',
    name: 'Harbor Steel Ltd',
    sector: 'Metals',
    status: 'closed',
    priceBandLow: 200,
    priceBandHigh: 210,
    lotSize: 70,
    opensOn: '2026-11-03',
    closesOn: '2026-11-06',
    issueSizeCrore: 900,
    allotmentOn: '2026-11-11',
    listing: 'NSE and BSE',
    minInvestment: 14700,
  },
  {
    id: 'summit-upcoming',
    name: 'Summit Pharma Ltd',
    sector: 'Pharmaceuticals',
    status: 'upcoming',
    priceBandLow: 410,
    priceBandHigh: 430,
    lotSize: 34,
    opensOn: '2026-12-02',
    closesOn: '2026-12-04',
    issueSizeCrore: 1500,
    allotmentOn: '2026-12-09',
    listing: 'NSE and BSE',
    minInvestment: 14620,
  },
];
