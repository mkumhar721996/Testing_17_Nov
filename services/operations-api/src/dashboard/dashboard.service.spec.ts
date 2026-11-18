import { NotFoundException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  const s = new DashboardService();

  it('returns the portfolio summary (AC1)', () => {
    const p = s.getPortfolio();
    expect(p).toMatchObject({ value: 482310, invested: 420000, returns: 62310 });
    expect(p.nextSip).toEqual({ amount: 5000, date: '2026-12-01' });
    expect(p.value - p.invested).toBe(p.returns);
  });

  it.each(['1m', '1y', 'all'] as const)('growth and returns series for %s (AC2, AC3)', (r) => {
    expect(s.getGrowth(r).length).toBeGreaterThan(1);
    expect(s.getReturns(r).length).toBeGreaterThan(1);
    expect(s.getGrowth(r).at(-1)!.value).toBe(s.getPortfolio().value);
    expect(s.getReturns(r).at(-1)!.value).toBe(s.getPortfolio().returns);
  });

  it('returns one allocation snapshot (AC4)', () => {
    const a = s.getAllocation();
    expect(a.asOf).toBe('2026-11-17');
    expect(a.slices.reduce((t, x) => t + x.pct, 0)).toBe(100);
    expect(Array.isArray(a)).toBe(false);
  });

  it('lists SIPs (AC5)', () => {
    expect(s.listSips().length).toBeGreaterThan(0);
    expect(s.listSips().map((x) => x.fund)).toContain('Nifty 50 Index Fund');
  });

  it('returns 3 gainers and 3 losers (AC6)', () => {
    const m = s.getMarketMovers();
    expect(m.gainers).toHaveLength(3);
    expect(m.losers).toHaveLength(3);
    expect(m.gainers.every((g) => g.changePct > 0)).toBe(true);
    expect(m.losers.every((l) => l.changePct < 0)).toBe(true);
  });

  it('lists only open IPOs (AC7)', () => {
    const open = s.listOpenIpos();
    expect(open.map((i) => i.id).sort()).toEqual(['greenleaf', 'skyline']);
    expect(open.every((i) => i.status === 'open')).toBe(true);
  });

  it('returns IPO detail for open IPOs only (AC8)', () => {
    for (const i of s.listOpenIpos()) expect(s.getIpo(i.id).id).toBe(i.id);
    expect(() => s.getIpo('does-not-exist')).toThrow(NotFoundException);
    expect(() => s.getIpo('harbor-closed')).toThrow(NotFoundException);
    expect(() => s.getIpo('summit-upcoming')).toThrow(NotFoundException);
  });

  it('belongs to a single investor (AC9)', () => {
    const id = s.getPortfolio().investorId;
    expect(id).toBe('INV-0001');
    expect(s.listSips().every((x) => x.investorId === id)).toBe(true);
  });
});
