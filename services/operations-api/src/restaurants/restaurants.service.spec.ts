import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../auth/current-user.decorator';
import type { RestaurantRecord, RestaurantsRepository } from './restaurants.repository';
import { RestaurantsService } from './restaurants.service';

const TENANT = 't1';

// Holds state only; every rule under test (who may save, what is valid, what is
// returned) lives in the service. SQL behaviour is covered by restaurants.repository.spec.ts.
class FakeRepository {
  rows = new Map<string, RestaurantRecord & { tenantId: string }>();
  managers = new Set<string>();
  saveDeliveryRadius = vi.fn(
    async (tenantId: string, id: string, km: number, actorId: string) => {
      if (!this.managers.has(`${tenantId}:${id}:${actorId}`)) return false;
      this.rows.get(id)!.deliveryRadiusKm = km;
      return true;
    },
  );
  list = vi.fn(async (_tenantId: string, _fulfilment: 'delivery' | 'pickup') => [
    { id: 'r1', name: 'Bistro Lumiere' },
  ]);

  async findRestaurant(tenantId: string, id: string) {
    const row = this.rows.get(id);
    return row && row.tenantId === tenantId ? row : null;
  }
  async isManager(tenantId: string, restaurantId: string, userId: string) {
    return this.managers.has(`${tenantId}:${restaurantId}:${userId}`);
  }
}

const manager: CurrentUser = { userId: 'm1', tenantId: TENANT };
const stranger: CurrentUser = { userId: 'u2', tenantId: TENANT };
const otherTenant: CurrentUser = { userId: 'm1', tenantId: 't2' };

describe('RestaurantsService', () => {
  let repo: FakeRepository;
  let service: RestaurantsService;

  beforeEach(() => {
    repo = new FakeRepository();
    repo.rows.set('r1', {
      tenantId: TENANT,
      id: 'r1',
      name: 'Bistro Lumiere',
      address: '14 Quay Street, Bristol BS1 4RB',
      deliveryRadiusKm: null,
    });
    repo.managers.add(`${TENANT}:r1:m1`);
    service = new RestaurantsService(repo as unknown as RestaurantsRepository);
  });

  it('AC1: manager saves a radius and then sees it', async () => {
    await service.setDeliveryRadius(manager, 'r1', 5);
    expect((await service.getDeliveryArea(manager, 'r1')).deliveryRadiusKm).toBe(5);
  });

  it('AC1: a save passes the tenant, restaurant, value and actor to the repository', async () => {
    await service.setDeliveryRadius(manager, 'r1', 5);
    expect(repo.saveDeliveryRadius).toHaveBeenCalledExactlyOnceWith(TENANT, 'r1', 5, 'm1');
  });

  it('AC2: a new save replaces the old value', async () => {
    await service.setDeliveryRadius(manager, 'r1', 5);
    await service.setDeliveryRadius(manager, 'r1', 8);
    expect((await service.getDeliveryArea(manager, 'r1')).deliveryRadiusKm).toBe(8);
    expect(repo.rows.get('r1')?.deliveryRadiusKm).toBe(8);
  });

  it('AC3: radius is straight-line from the operator-set address', async () => {
    expect(await service.getDeliveryArea(manager, 'r1')).toEqual({
      address: '14 Quay Street, Bristol BS1 4RB',
      deliveryRadiusKm: null,
      measuredFrom: 'straight-line',
    });
  });

  it('AC4: a non-manager is refused and nothing is written', async () => {
    await expect(service.setDeliveryRadius(stranger, 'r1', 5)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.getDeliveryArea(stranger, 'r1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repo.saveDeliveryRadius).not.toHaveBeenCalled();
    expect(repo.rows.get('r1')?.deliveryRadiusKm).toBeNull();
  });

  it('AC4: a non-manager is refused before the value is judged', async () => {
    await expect(service.setDeliveryRadius(stranger, 'r1', 0)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses when the repository reports the actor is no longer a manager', async () => {
    repo.saveDeliveryRadius.mockResolvedValueOnce(false);
    await expect(service.setDeliveryRadius(manager, 'r1', 5)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('answers 403, not 404, for a restaurant that does not exist', async () => {
    await expect(service.setDeliveryRadius(manager, 'missing', 5)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.getDeliveryArea(manager, 'missing')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("refuses another tenant's restaurant", async () => {
    await expect(service.setDeliveryRadius(otherTenant, 'r1', 5)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repo.saveDeliveryRadius).not.toHaveBeenCalled();
  });

  it('reports not found when a manager row points at a restaurant that is gone', async () => {
    repo.managers.add(`${TENANT}:ghost:m1`);
    await expect(service.getDeliveryArea(manager, 'ghost')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it.each(['delivery', 'pickup'] as const)(
    'AC5/6: %s listing asks the repository with the caller tenant and returns its rows',
    async (fulfilment) => {
      expect(await service.listForFulfilment(stranger, fulfilment)).toEqual([
        { id: 'r1', name: 'Bistro Lumiere' },
      ]);
      expect(repo.list).toHaveBeenCalledExactlyOnceWith(TENANT, fulfilment);
    },
  );

  it('AC5: saving a radius does not touch the listing', async () => {
    await service.setDeliveryRadius(manager, 'r1', 5);
    expect(repo.list).not.toHaveBeenCalled();
  });

  it.each([0, 51, 2.5, -1, 1.0000001, 50.5, '5', null, undefined, NaN, Infinity, true, [5]])(
    'AC7/8/11: refuses %s and writes nothing',
    async (km) => {
      await expect(service.setDeliveryRadius(manager, 'r1', km)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repo.saveDeliveryRadius).not.toHaveBeenCalled();
    },
  );

  it.each([1, 2, 25, 49, 50])('AC9/10: accepts %s km', async (km) => {
    await expect(service.setDeliveryRadius(manager, 'r1', km)).resolves.toEqual({
      deliveryRadiusKm: km,
    });
  });
});
