import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CurrentUser } from '../auth/current-user.decorator';
import type { RestaurantRecord, RestaurantsRepository } from './restaurants.repository';
import { RestaurantsService } from './restaurants.service';

const TENANT = 't1';

class FakeRepository {
  rows = new Map<string, RestaurantRecord & { tenantId: string }>();
  managers = new Set<string>();
  saves: Array<{ id: string; km: number }> = [];
  audit: Array<{ action: string; entityId: string; actorId: string; tenantId: string }> = [];

  async findRestaurant(tenantId: string, id: string) {
    const row = this.rows.get(id);
    return row && row.tenantId === tenantId ? row : null;
  }
  async isManager(tenantId: string, restaurantId: string, userId: string) {
    return this.managers.has(`${tenantId}:${restaurantId}:${userId}`);
  }
  async saveDeliveryRadius(tenantId: string, id: string, km: number, actorId: string) {
    this.rows.get(id)!.deliveryRadiusKm = km;
    this.saves.push({ id, km });
    this.audit.push({ action: 'delivery_radius.set', entityId: id, actorId, tenantId });
  }
  async list(tenantId: string, fulfilment: 'delivery' | 'pickup') {
    return [...this.rows.values()]
      .filter((r) => r.tenantId === tenantId)
      .filter((r) => fulfilment === 'pickup' || r.deliveryRadiusKm !== null)
      .map((r) => ({ id: r.id, name: r.name }));
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
    repo.rows.set('r2', {
      tenantId: TENANT,
      id: 'r2',
      name: 'No Radius Cafe',
      address: '1 High Street',
      deliveryRadiusKm: null,
    });
    repo.managers.add(`${TENANT}:r1:m1`);
    service = new RestaurantsService(repo as unknown as RestaurantsRepository);
  });

  it('AC1: manager saves a radius and then sees it', async () => {
    await service.setDeliveryRadius(manager, 'r1', 5);
    expect((await service.getDeliveryArea(manager, 'r1')).deliveryRadiusKm).toBe(5);
  });

  it('AC2: a new save replaces the old value', async () => {
    await service.setDeliveryRadius(manager, 'r1', 5);
    await service.setDeliveryRadius(manager, 'r1', 8);
    expect((await service.getDeliveryArea(manager, 'r1')).deliveryRadiusKm).toBe(8);
    expect(repo.rows.get('r1')?.deliveryRadiusKm).toBe(8);
  });

  it('AC3: radius is straight-line from the operator-set address', async () => {
    expect(await service.getDeliveryArea(manager, 'r1')).toMatchObject({
      address: '14 Quay Street, Bristol BS1 4RB',
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
    expect(repo.saves).toHaveLength(0);
    expect(repo.audit).toHaveLength(0);
  });

  it("refuses another tenant's restaurant as not found", async () => {
    await expect(service.setDeliveryRadius(otherTenant, 'r1', 5)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.saves).toHaveLength(0);
  });

  it('AC5: pickup lists restaurants with a radius, and saving does not change it', async () => {
    const before = await service.listForFulfilment(stranger, 'pickup');
    await service.setDeliveryRadius(manager, 'r1', 5);
    expect(await service.listForFulfilment(stranger, 'pickup')).toEqual(before);
    expect(before).toContainEqual({ id: 'r1', name: 'Bistro Lumiere' });
  });

  it('AC6: delivery omits restaurants with no radius', async () => {
    expect(await service.listForFulfilment(stranger, 'delivery')).not.toContainEqual(
      expect.objectContaining({ id: 'r2' }),
    );
    await service.setDeliveryRadius(manager, 'r1', 5);
    expect(await service.listForFulfilment(stranger, 'delivery')).toEqual([
      { id: 'r1', name: 'Bistro Lumiere' },
    ]);
  });

  it.each([0, 51, 2.5, -1, '5', null, undefined, NaN, Infinity])(
    'AC7/8/11: refuses %s and writes nothing',
    async (km) => {
      await expect(service.setDeliveryRadius(manager, 'r1', km)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repo.saves).toHaveLength(0);
      expect(repo.audit).toHaveLength(0);
    },
  );

  it.each([1, 50])('AC9/10: accepts %s km', async (km) => {
    await expect(service.setDeliveryRadius(manager, 'r1', km)).resolves.toEqual({
      deliveryRadiusKm: km,
    });
  });

  it('writes one audit entry for a successful save', async () => {
    await service.setDeliveryRadius(manager, 'r1', 5);
    expect(repo.audit).toEqual([
      expect.objectContaining({
        action: 'delivery_radius.set',
        entityId: 'r1',
        actorId: 'm1',
        tenantId: TENANT,
      }),
    ]);
  });
});
