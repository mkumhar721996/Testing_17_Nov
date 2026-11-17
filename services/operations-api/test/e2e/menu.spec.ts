import { APIRequestContext, expect, test } from '@playwright/test';
import { Pool } from 'pg';
import {
  MANAGER_A,
  MANAGER_B,
  RESTAURANT_A,
  RESTAURANT_B,
  STRANGER_A,
  hasDatabase,
  resetMenus,
  seed,
} from './seed';

test.skip(!hasDatabase, 'DATABASE_URL is not set');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const menuUrl = (rid: string) => `/restaurants/${rid}/menu`;

test.beforeAll(async () => seed(pool));
test.beforeEach(async () => resetMenus(pool));
test.afterAll(async () => pool.end());

async function addSection(request: APIRequestContext, name = 'Starters', rid = RESTAURANT_A) {
  const res = await request.post(`${menuUrl(rid)}/sections`, {
    headers: MANAGER_A,
    data: { name },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).id as string;
}

async function addItem(
  request: APIRequestContext,
  sid: string,
  data: Record<string, unknown> = { name: 'Tomato soup', description: 'Basil', price: '7.50' },
) {
  const res = await request.post(`${menuUrl(RESTAURANT_A)}/sections/${sid}/items`, {
    headers: MANAGER_A,
    data,
  });
  expect(res.status()).toBe(201);
  return (await res.json()).id as string;
}

const getMenu = async (request: APIRequestContext, rid = RESTAURANT_A) =>
  (await request.get(menuUrl(rid))).json();

test('AC1 section appears in the menu', async ({ request }) => {
  await addSection(request);
  expect((await getMenu(request)).sections.map((s: { name: string }) => s.name)).toEqual([
    'Starters',
  ]);
});

test('AC2/13/20/21 item values are read back as entered', async ({ request }) => {
  const sid = await addSection(request);
  await addItem(request, sid, { name: 'Soup', description: 'Basil', price: '7.50' });
  await addItem(request, sid, { name: 'Bread', price: '12' });
  await addItem(request, sid, { name: 'Mint', price: '0.01' });
  const items = (await getMenu(request)).sections[0].items;
  expect(items.map((i: { price: string }) => i.price)).toEqual(['7.50', '12.00', '0.01']);
  expect(items[1].description).toBe('');
});

test('AC3 section rename', async ({ request }) => {
  const sid = await addSection(request);
  const res = await request.patch(`${menuUrl(RESTAURANT_A)}/sections/${sid}`, {
    headers: MANAGER_A,
    data: { name: 'Mains' },
  });
  expect(res.ok()).toBe(true);
  expect((await getMenu(request)).sections[0].name).toBe('Mains');
});

test('AC4/14 each edit shows on the next unauthenticated load, never cached', async ({
  request,
}) => {
  const sid = await addSection(request);
  const iid = await addItem(request, sid);
  for (const patch of [{ name: 'Soup 2' }, { description: 'New text' }, { price: '9.00' }]) {
    const res = await request.patch(`${menuUrl(RESTAURANT_A)}/items/${iid}`, {
      headers: MANAGER_A,
      data: patch,
    });
    expect(res.ok()).toBe(true);
    const fresh = await request.get(menuUrl(RESTAURANT_A));
    expect(fresh.headers()['cache-control']).toBe('no-store');
    expect((await fresh.json()).sections[0].items[0]).toMatchObject(patch);
  }
});

test('AC5/15 removed item is gone', async ({ request }) => {
  const sid = await addSection(request);
  const iid = await addItem(request, sid);
  const res = await request.delete(`${menuUrl(RESTAURANT_A)}/items/${iid}`, {
    headers: MANAGER_A,
  });
  expect(res.status()).toBe(204);
  expect(JSON.stringify(await getMenu(request))).not.toContain('Tomato soup');
});

test('AC6/7/18/19 invalid items are not saved', async ({ request }) => {
  const sid = await addSection(request);
  const bad = [
    { price: '5.00' },
    { name: '  ', price: '5.00' },
    { name: 'Soup' },
    { name: 'Soup', price: '0' },
    { name: 'Soup', price: '-1' },
    { name: 'Soup', price: '1.234' },
    { name: 'Soup', price: 7.5 },
  ];
  for (const data of bad) {
    const res = await request.post(`${menuUrl(RESTAURANT_A)}/sections/${sid}/items`, {
      headers: MANAGER_A,
      data,
    });
    expect(res.status()).toBe(400);
  }
  expect((await getMenu(request)).sections[0].items).toHaveLength(0);
});

test('AC8/9 no extras and no import', async ({ request }) => {
  const sid = await addSection(request);
  const res = await request.post(`${menuUrl(RESTAURANT_A)}/sections/${sid}/items`, {
    headers: MANAGER_A,
    data: { name: 'Soup', price: '5.00', extras: [] },
  });
  expect(res.status()).toBe(400);
  const imp = await request.post(`${menuUrl(RESTAURANT_A)}/import`, { headers: MANAGER_A, data: {} });
  expect(imp.status()).toBe(404);
});

test('AC10/11 non-managers and other restaurants managers are refused on all writes', async ({
  request,
}) => {
  const sid = await addSection(request);
  const iid = await addItem(request, sid);
  const base = menuUrl(RESTAURANT_A);
  const calls = (headers: Record<string, string>, root: string) => [
    request.post(`${root}/sections`, { headers, data: { name: 'X' } }),
    request.patch(`${root}/sections/${sid}`, { headers, data: { name: 'X' } }),
    request.delete(`${root}/sections/${sid}`, { headers }),
    request.post(`${root}/sections/${sid}/items`, { headers, data: { name: 'X', price: '1' } }),
    request.patch(`${root}/items/${iid}`, { headers, data: { name: 'X' } }),
    request.delete(`${root}/items/${iid}`, { headers }),
  ];
  for (const res of await Promise.all(calls(STRANGER_A, base))) expect(res.status()).toBe(403);
  for (const res of await Promise.all(calls(MANAGER_B, base))) expect(res.status()).toBe(403);
  for (const res of await Promise.all(calls(MANAGER_A, menuUrl(RESTAURANT_B)))) {
    expect(res.status()).toBe(403);
  }
  for (const res of await Promise.all(calls({}, base))) expect(res.status()).toBe(401);
  const menu = await getMenu(request);
  expect(menu.sections).toHaveLength(1);
  expect(menu.sections[0].items).toHaveLength(1);
  expect(menu.sections[0].name).toBe('Starters');
  expect((await getMenu(request, RESTAURANT_B)).sections).toHaveLength(0);
});

test('AC11 an item id from another restaurant is 404 under my restaurant', async ({ request }) => {
  const sectionB = await request.post(`${menuUrl(RESTAURANT_B)}/sections`, {
    headers: MANAGER_B,
    data: { name: 'B section' },
  });
  const sidB = (await sectionB.json()).id;
  const itemB = await request.post(`${menuUrl(RESTAURANT_B)}/sections/${sidB}/items`, {
    headers: MANAGER_B,
    data: { name: 'B dish', price: '4.00' },
  });
  const iidB = (await itemB.json()).id;
  const res = await request.delete(`${menuUrl(RESTAURANT_A)}/items/${iidB}`, {
    headers: MANAGER_A,
  });
  expect(res.status()).toBe(404);
  expect((await getMenu(request, RESTAURANT_B)).sections[0].items).toHaveLength(1);
});

test('AC12 prices carry the restaurant currency', async ({ request }) => {
  const sid = await addSection(request);
  await addItem(request, sid, { name: 'A', price: '1.00' });
  await addItem(request, sid, { name: 'B', price: '2.00' });
  await addItem(request, sid, { name: 'C', price: '3.00' });
  const body = await getMenu(request);
  expect(body.restaurant.currency).toBe('EUR');
  expect(JSON.stringify(body.sections)).not.toContain('currency');
});

test('AC16/17 only empty sections are removed', async ({ request }) => {
  const sid = await addSection(request);
  const iid = await addItem(request, sid);
  const url = `${menuUrl(RESTAURANT_A)}/sections/${sid}`;
  expect((await request.delete(url, { headers: MANAGER_A })).status()).toBe(409);
  expect((await getMenu(request)).sections).toHaveLength(1);
  await request.delete(`${menuUrl(RESTAURANT_A)}/items/${iid}`, { headers: MANAGER_A });
  expect((await request.delete(url, { headers: MANAGER_A })).status()).toBe(204);
  expect((await getMenu(request)).sections).toHaveLength(0);
});

test('the database rejects a zero price and audits every write', async ({ request }) => {
  const sid = await addSection(request);
  const iid = await addItem(request, sid);
  await expect(
    pool.query(
      `INSERT INTO menu_items (id, tenant_id, restaurant_id, section_id, name, price)
       SELECT gen_random_uuid(), tenant_id, restaurant_id, id, 'Zero', 0 FROM menu_sections`,
    ),
  ).rejects.toThrow();
  const { rows } = await pool.query(
    `SELECT action, entity, entity_id, actor_sub FROM audit_log
     WHERE entity_id = ANY($1::uuid[]) ORDER BY id`,
    [[sid, iid]],
  );
  expect(rows).toEqual([
    { action: 'create', entity: 'menu_section', entity_id: sid, actor_sub: 'manager-a' },
    { action: 'create', entity: 'menu_item', entity_id: iid, actor_sub: 'manager-a' },
  ]);
});
