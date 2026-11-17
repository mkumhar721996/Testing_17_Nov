import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthGuard, TOKEN_VERIFIER } from '../auth/auth.guard';
import { RestaurantsController } from './restaurants.controller';
import { RestaurantsRepository } from './restaurants.repository';
import { RestaurantsService } from './restaurants.service';

const users: Record<string, { userId: string; tenantId: string }> = {
  manager: { userId: 'm1', tenantId: 't1' },
  stranger: { userId: 'u2', tenantId: 't1' },
  foreign: { userId: 'm1', tenantId: 't2' },
};

let radius: number | null = null;
const repo = {
  findRestaurant: async (tenantId: string, id: string) =>
    tenantId === 't1' && id === 'r1'
      ? { id, name: 'Bistro Lumiere', address: '14 Quay Street', deliveryRadiusKm: radius }
      : null,
  isManager: async (_t: string, _r: string, userId: string) => userId === 'm1',
  saveDeliveryRadius: async (_t: string, _id: string, km: number) => {
    radius = km;
  },
  list: async () => [],
};

describe('RestaurantsController', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [RestaurantsController],
      providers: [
        { provide: RestaurantsRepository, useValue: repo },
        RestaurantsService,
        AuthGuard,
        { provide: TOKEN_VERIFIER, useValue: { verify: async (t: string) => users[t] ?? null } },
      ],
    }).compile();
    app = mod.createNestApplication();
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });
  afterAll(() => app.close());

  const put = (token: string | null, body: unknown) =>
    fetch(`${base}/restaurants/r1/delivery-area`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

  it('401 without a bearer token', async () => {
    expect((await put(null, { deliveryRadiusKm: 5 })).status).toBe(401);
  });

  it('403 for a non-manager', async () => {
    expect((await put('stranger', { deliveryRadiusKm: 5 })).status).toBe(403);
  });

  it("404 for another tenant's restaurant", async () => {
    expect((await put('foreign', { deliveryRadiusKm: 5 })).status).toBe(404);
  });

  it.each([2.5, 0, 51, '5', null])('400 for %s', async (km) => {
    expect((await put('manager', { deliveryRadiusKm: km })).status).toBe(400);
  });

  it('saves and reads back the radius', async () => {
    expect((await put('manager', { deliveryRadiusKm: 8 })).status).toBe(200);
    const res = await fetch(`${base}/restaurants/r1/delivery-area`, {
      headers: { authorization: 'Bearer manager' },
    });
    expect(await res.json()).toEqual({
      address: '14 Quay Street',
      deliveryRadiusKm: 8,
      measuredFrom: 'straight-line',
    });
  });

  it('400 for an unknown fulfilment', async () => {
    const res = await fetch(`${base}/restaurants?fulfilment=teleport`, {
      headers: { authorization: 'Bearer manager' },
    });
    expect(res.status).toBe(400);
  });
});
