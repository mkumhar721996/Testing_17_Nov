import type {
  AllocationSlice,
  ChartRange,
  Ipo,
  Mover,
  PortfolioSummary,
  SeriesPoint,
  Sip,
} from './dashboard.types';

// Placeholder data for a single investor; a real source replaces it later.
export const INVESTOR_ID = 'INV-0001';

export const portfolioSummary: PortfolioSummary = {
  portfolioValue: 482310,
  investedAmount: 420000,
  returns: 62310,
  returnsPercent: 14.8,
  nextSip: { amount: 5000, date: '2026-12-01' },
};

const growthSeries: Record<ChartRange, SeriesPoint[]> = {
  '1M': [
    { date: '2026-10-18', value: 468200 },
    { date: '2026-10-25', value: 472900 },
    { date: '2026-11-01', value: 475600 },
    { date: '2026-11-08', value: 479100 },
    { date: '2026-11-17', value: 482310 },
  ],
  '1Y': [
    { date: '2025-11-17', value: 351000 },
    { date: '2026-02-17', value: 389500 },
    { date: '2026-05-17', value: 428800 },
    { date: '2026-08-17', value: 459300 },
    { date: '2026-11-17', value: 482310 },
  ],
  All: [
    { date: '2023-11-17', value: 90000 },
    { date: '2024-11-17', value: 245000 },
    { date: '2025-11-17', value: 351000 },
    { date: '2026-11-17', value: 482310 },
  ],
};

const returnsSeries: Record<ChartRange, SeriesPoint[]> = {
  '1M': [
    { date: '2026-10-18', value: 48200 },
    { date: '2026-10-25', value: 52900 },
    { date: '2026-11-01', value: 55600 },
    { date: '2026-11-08', value: 59100 },
    { date: '2026-11-17', value: 62310 },
  ],
  '1Y': [
    { date: '2025-11-17', value: 21000 },
    { date: '2026-02-17', value: 33500 },
    { date: '2026-05-17', value: 47800 },
    { date: '2026-08-17', value: 56300 },
    { date: '2026-11-17', value: 62310 },
  ],
  All: [
    { date: '2023-11-17', value: 0 },
    { date: '2024-11-17', value: 15000 },
    { date: '2025-11-17', value: 21000 },
    { date: '2026-11-17', value: 62310 },
  ],
};

export const growthFor = (range: ChartRange) => growthSeries[range];
export const returnsFor = (range: ChartRange) => returnsSeries[range];

const allocation = [
  { assetClass: 'Equity', percent: 55 },
  { assetClass: 'Debt', percent: 25 },
  { assetClass: 'Gold', percent: 12 },
  { assetClass: 'Cash', percent: 8 },
];
export const allocationSlices: AllocationSlice[] = allocation.map((s) => ({
  ...s,
  value: Math.round((portfolioSummary.portfolioValue * s.percent) / 100),
}));

export const sips: Sip[] = [
  { id: 'sip-1', investorId: INVESTOR_ID, fundName: 'Nifty 50 Index Fund', amount: 5000, nextDate: '2026-12-01', status: 'Active' },
  { id: 'sip-2', investorId: INVESTOR_ID, fundName: 'Bluechip Equity Fund', amount: 3000, nextDate: '2026-12-05', status: 'Active' },
  { id: 'sip-3', investorId: INVESTOR_ID, fundName: 'Midcap Growth Fund', amount: 2000, nextDate: '2026-12-10', status: 'Active' },
  { id: 'sip-4', investorId: INVESTOR_ID, fundName: 'Gold ETF', amount: 1000, nextDate: '2026-12-15', status: 'Paused' },
];

export const gainers: Mover[] = [
  { symbol: 'TATAMOTORS', name: 'Tata Motors', changePercent: 4.2 },
  { symbol: 'INFY', name: 'Infosys', changePercent: 3.1 },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', changePercent: 2.6 },
];

export const losers: Mover[] = [
  { symbol: 'ADANIPORTS', name: 'Adani Ports', changePercent: -3.4 },
  { symbol: 'WIPRO', name: 'Wipro', changePercent: -2.9 },
  { symbol: 'SUNPHARMA', name: 'Sun Pharma', changePercent: -2.2 },
];

export const ipos: Ipo[] = [
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
    id: 'harbor-health',
    name: 'Harbor Health Systems Ltd',
    sector: 'Healthcare services',
    status: 'upcoming',
    priceBandLow: 240,
    priceBandHigh: 252,
    lotSize: 59,
    opensOn: '2026-11-25',
    closesOn: '2026-11-28',
    issueSizeCrore: 880,
    allotmentOn: '2026-12-03',
    listing: 'NSE and BSE',
    minInvestment: 14868,
  },
  {
    id: 'meridian-power',
    name: 'Meridian Power Ltd',
    sector: 'Renewable energy',
    status: 'closed',
    priceBandLow: 96,
    priceBandHigh: 102,
    lotSize: 147,
    opensOn: '2026-11-05',
    closesOn: '2026-11-10',
    issueSizeCrore: 520,
    allotmentOn: '2026-11-13',
    listing: 'NSE and BSE',
    minInvestment: 14994,
  },
];
