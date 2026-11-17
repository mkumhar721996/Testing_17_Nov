import { describe, expect, it } from 'vitest';
import { InMemoryMenuRepository } from './in-memory-menu.repository';
import { MenuService } from './menu.service';

const manager = { sub: 'mgr-a', tenantId: 'tenant-a' };
const other = { sub: 'mgr-b', tenantId: 'tenant-b' };
const stranger = { sub: 'nobody', tenantId: 'tenant-a' };

function setup() {
  const repo = new InMemoryMenuRepository();
  repo.seedRestaurant('rid-a', 'tenant-a', 'Bistro A', 'EUR', ['mgr-a']);
  repo.seedRestaurant('rid-b', 'tenant-b', 'Bistro B', 'USD', ['mgr-b']);
  return { repo, svc: new MenuService(repo) };
}

async function withSection() {
  const ctx = setup();
  const s = await ctx.svc.addSection(manager, 'rid-a', { name: 'Starters' });
  return { ...ctx, sid: s.id };
}

describe('MenuService', () => {
  it('AC1 adds a section', async () => {
    const { svc } = setup();
    await svc.addSection(manager, 'rid-a', { name: 'Starters' });
    expect((await svc.getMenu('rid-a')).sections.map((x) => x.name)).toEqual(['Starters']);
  });

  it('AC2 adds an item', async () => {
    const { svc, sid } = await withSection();
    await svc.addItem(manager, 'rid-a', sid, {
      name: 'Tomato soup',
      description: 'Slow-roasted tomatoes, basil oil',
      price: '7.50',
    });
    expect((await svc.getMenu('rid-a')).sections[0].items[0]).toMatchObject({
      name: 'Tomato soup',
      description: 'Slow-roasted tomatoes, basil oil',
      price: '7.50',
    });
  });

  it('AC3 renames a section', async () => {
    const { svc, sid } = await withSection();
    await svc.renameSection(manager, 'rid-a', sid, { name: 'Mains' });
    expect((await svc.getMenu('rid-a')).sections[0].name).toBe('Mains');
  });

  it.each([
    [{ name: 'Soup 2' }, { name: 'Soup 2', description: 'd', price: '7.50' }],
    [{ description: 'new' }, { name: 'Soup', description: 'new', price: '7.50' }],
    [{ price: '9.00' }, { name: 'Soup', description: 'd', price: '9.00' }],
  ])('AC4 edits an item with %j', async (patch, expected) => {
    const { svc, sid } = await withSection();
    const item = await svc.addItem(manager, 'rid-a', sid, {
      name: 'Soup',
      description: 'd',
      price: '7.50',
    });
    await svc.updateItem(manager, 'rid-a', item.id, patch);
    expect((await svc.getMenu('rid-a')).sections[0].items[0]).toMatchObject(expected);
  });

  it('AC5 removes an item', async () => {
    const { svc, sid } = await withSection();
    const item = await svc.addItem(manager, 'rid-a', sid, { name: 'Soup', price: '7.50' });
    await svc.removeItem(manager, 'rid-a', item.id);
    expect((await svc.getMenu('rid-a')).sections[0].items).toHaveLength(0);
  });

  it('AC6 rejects an item without a name', async () => {
    const { svc, sid, repo } = await withSection();
    await expect(
      svc.addItem(manager, 'rid-a', sid, { name: '  ', price: '5.00' }),
    ).rejects.toMatchObject({ response: { errors: { name: expect.any(String) } } });
    expect(repo.itemCount()).toBe(0);
  });

  it('AC7 rejects an item without a price', async () => {
    const { svc, sid, repo } = await withSection();
    await expect(svc.addItem(manager, 'rid-a', sid, { name: 'Soup' })).rejects.toMatchObject({
      response: { errors: { price: expect.any(String) } },
    });
    expect(repo.itemCount()).toBe(0);
  });

  it.each(['0', '-1', '1.234'])('AC18/19 rejects price %s', async (price) => {
    const { svc, sid, repo } = await withSection();
    await expect(svc.addItem(manager, 'rid-a', sid, { name: 'Soup', price })).rejects.toMatchObject(
      { status: 400 },
    );
    expect(repo.itemCount()).toBe(0);
  });

  it('rejects an invalid price on update', async () => {
    const { svc, sid } = await withSection();
    const item = await svc.addItem(manager, 'rid-a', sid, { name: 'Soup', price: '7.50' });
    await expect(svc.updateItem(manager, 'rid-a', item.id, { price: '0' })).rejects.toMatchObject({
      status: 400,
    });
  });

  it('AC20 saves a price of 0.01', async () => {
    const { svc, sid, repo } = await withSection();
    await svc.addItem(manager, 'rid-a', sid, { name: 'Mint', price: '0.01' });
    expect(repo.itemCount()).toBe(1);
  });

  it('AC21 defaults the description to empty', async () => {
    const { svc, sid } = await withSection();
    await svc.addItem(manager, 'rid-a', sid, { name: 'Bread', price: '3.00' });
    expect((await svc.getMenu('rid-a')).sections[0].items[0].description).toBe('');
  });

  it('AC16 refuses to remove a section with items', async () => {
    const { svc, sid } = await withSection();
    await svc.addItem(manager, 'rid-a', sid, { name: 'Soup', price: '7.50' });
    await expect(svc.removeSection(manager, 'rid-a', sid)).rejects.toMatchObject({ status: 409 });
    expect((await svc.getMenu('rid-a')).sections).toHaveLength(1);
  });

  it('AC17 removes an empty section', async () => {
    const { svc, sid } = await withSection();
    await svc.removeSection(manager, 'rid-a', sid);
    expect((await svc.getMenu('rid-a')).sections).toHaveLength(0);
  });

  it('AC10 refuses a non-manager on every write', async () => {
    const { svc, sid, repo } = await withSection();
    const item = await svc.addItem(manager, 'rid-a', sid, { name: 'Soup', price: '7.50' });
    const writes = [
      () => svc.addSection(stranger, 'rid-a', { name: 'X' }),
      () => svc.renameSection(stranger, 'rid-a', sid, { name: 'X' }),
      () => svc.removeSection(stranger, 'rid-a', sid),
      () => svc.addItem(stranger, 'rid-a', sid, { name: 'X', price: '1.00' }),
      () => svc.updateItem(stranger, 'rid-a', item.id, { name: 'X' }),
      () => svc.removeItem(stranger, 'rid-a', item.id),
    ];
    for (const w of writes) await expect(w()).rejects.toMatchObject({ status: 403 });
    expect(repo.itemCount()).toBe(1);
  });

  it('AC11 refuses a manager of another restaurant with the same 403', async () => {
    const { svc, sid } = await withSection();
    await expect(svc.addSection(manager, 'rid-b', { name: 'X' })).rejects.toMatchObject({
      status: 403,
    });
    await expect(svc.addSection(other, 'rid-a', { name: 'X' })).rejects.toMatchObject({
      status: 403,
    });
    await expect(svc.removeSection(manager, 'rid-b', sid)).rejects.toMatchObject({ status: 403 });
  });

  it('resolves ids through the restaurant', async () => {
    const { svc, sid } = await withSection();
    const item = await svc.addItem(manager, 'rid-a', sid, { name: 'Soup', price: '7.50' });
    await expect(svc.removeItem(other, 'rid-b', item.id)).rejects.toMatchObject({ status: 404 });
    await expect(
      svc.addItem(other, 'rid-b', sid, { name: 'X', price: '1.00' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('AC12 returns the restaurant currency; unknown restaurant is 404', async () => {
    const { svc } = setup();
    expect((await svc.getMenu('rid-a')).restaurant.currency).toBe('EUR');
    await expect(svc.getMenu('missing')).rejects.toMatchObject({ status: 404 });
  });

  it('audits each successful write once and failed validation never', async () => {
    const { svc, sid, repo } = await withSection();
    expect(repo.audit).toHaveLength(1);
    await svc.addItem(manager, 'rid-a', sid, { name: 'Soup', price: '7.50' });
    expect(repo.audit).toHaveLength(2);
    expect(repo.audit[1]).toMatchObject({ actorSub: 'mgr-a', tenantId: 'tenant-a' });
    await expect(svc.addItem(manager, 'rid-a', sid, { name: '', price: '1' })).rejects.toBeTruthy();
    expect(repo.audit).toHaveLength(2);
  });
});
