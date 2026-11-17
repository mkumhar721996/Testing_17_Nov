import type { Pool } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RestaurantsRepository } from './restaurants.repository';

// No Postgres runs in unit tests, so these check the SQL the repository sends and how it
// handles the result: tenant scoping, the delivery filter, the manager guard and the audit insert.
type Call = { sql: string; params: unknown[] };

function fakePool(respond: (call: Call) => { rows?: unknown[]; rowCount?: number } = () => ({})) {
  const calls: Call[] = [];
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    const call = { sql: sql.replace(/\s+/g, ' ').trim(), params };
    calls.push(call);
    return { rows: [], rowCount: 1, ...respond(call) };
  });
  const release = vi.fn();
  const pool = { query, connect: async () => ({ query, release }) } as unknown as Pool;
  return { calls, release, repo: new RestaurantsRepository(pool) };
}

describe('RestaurantsRepository', () => {
  describe('list', () => {
    it('AC6: delivery only returns restaurants that have a radius', async () => {
      const { calls, repo } = fakePool();
      await repo.list('t1', 'delivery');
      expect(calls[0].sql).toContain('delivery_radius_km IS NOT NULL');
      expect(calls[0].params).toEqual(['t1']);
    });

    it('AC5: pickup does not filter on the radius', async () => {
      const { calls, repo } = fakePool();
      await repo.list('t1', 'pickup');
      expect(calls[0].sql).not.toContain('delivery_radius_km');
      expect(calls[0].sql).toContain('tenant_id = $1');
      expect(calls[0].params).toEqual(['t1']);
    });

    it('returns the rows it is given', async () => {
      const rows = [{ id: 'r1', name: 'Bistro Lumiere' }];
      const { repo } = fakePool(() => ({ rows }));
      expect(await repo.list('t1', 'pickup')).toEqual(rows);
    });
  });

  describe('reads', () => {
    it('findRestaurant is scoped to the tenant and returns null when nothing matches', async () => {
      const { calls, repo } = fakePool();
      expect(await repo.findRestaurant('t1', 'r1')).toBeNull();
      expect(calls[0].sql).toContain('tenant_id = $1');
      expect(calls[0].params).toEqual(['t1', 'r1']);
    });

    it('isManager is scoped to the tenant, restaurant and user', async () => {
      const { calls, repo } = fakePool(() => ({ rowCount: 1 }));
      expect(await repo.isManager('t1', 'r1', 'm1')).toBe(true);
      expect(calls[0].sql).toContain('tenant_id = $1');
      expect(calls[0].params).toEqual(['t1', 'r1', 'm1']);
    });

    it('isManager is false without a manager row', async () => {
      const { repo } = fakePool(() => ({ rowCount: 0 }));
      expect(await repo.isManager('t1', 'r1', 'u2')).toBe(false);
    });
  });

  describe('saveDeliveryRadius', () => {
    let fake: ReturnType<typeof fakePool>;
    beforeEach(() => {
      fake = fakePool();
    });

    it('updates the radius and inserts exactly one audit row in one transaction', async () => {
      expect(await fake.repo.saveDeliveryRadius('t1', 'r1', 8, 'm1')).toBe(true);
      const sqls = fake.calls.map((c) => c.sql);
      expect(sqls[0]).toBe('BEGIN');
      expect(sqls[1]).toContain('UPDATE restaurants SET delivery_radius_km = $3');
      expect(fake.calls[1].params).toEqual(['t1', 'r1', 8, 'm1']);
      expect(sqls.filter((s) => s.startsWith('INSERT INTO audit_log'))).toHaveLength(1);
      expect(sqls.at(-1)).toBe('COMMIT');
      const audit = fake.calls.find((c) => c.sql.startsWith('INSERT INTO audit_log'))!;
      expect(audit.sql).toContain("'delivery_radius.set'");
      expect(audit.params).toEqual(['t1', 'm1', 'r1', JSON.stringify({ deliveryRadiusKm: 8 })]);
      expect(fake.release).toHaveBeenCalledOnce();
    });

    it('the update is guarded by a manager row for the actor in the same tenant', async () => {
      await fake.repo.saveDeliveryRadius('t1', 'r1', 8, 'm1');
      const update = fake.calls[1].sql;
      expect(update).toContain('tenant_id = $1 AND id = $2');
      expect(update).toContain('FROM restaurant_managers');
      expect(update).toContain('m.user_id = $4');
    });

    it('writes no audit row and rolls back when the update matches nothing', async () => {
      const { calls, release, repo } = fakePool((call) =>
        call.sql.startsWith('UPDATE') ? { rowCount: 0 } : {},
      );
      expect(await repo.saveDeliveryRadius('t1', 'r1', 8, 'u2')).toBe(false);
      expect(calls.map((c) => c.sql)).toEqual([
        'BEGIN',
        expect.stringContaining('UPDATE'),
        'ROLLBACK',
      ]);
      expect(release).toHaveBeenCalledOnce();
    });

    it('rolls back, releases and rethrows when the audit insert fails', async () => {
      const { calls, release, repo } = fakePool((call) => {
        if (call.sql.startsWith('INSERT')) throw new Error('db down');
        return {};
      });
      await expect(repo.saveDeliveryRadius('t1', 'r1', 8, 'm1')).rejects.toThrow('db down');
      expect(calls.at(-1)?.sql).toBe('ROLLBACK');
      expect(release).toHaveBeenCalledOnce();
    });
  });
});
