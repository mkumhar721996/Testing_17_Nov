import { randomUUID } from 'node:crypto';
import {
  AuditEntry,
  Caller,
  Menu,
  MenuItem,
  MenuRepository,
  MenuSection,
  RemoveSectionResult,
} from './menu.repository';

interface SectionRow {
  id: string;
  tenantId: string;
  restaurantId: string;
  name: string;
}
interface ItemRow extends MenuItem {
  tenantId: string;
  restaurantId: string;
  sectionId: string;
}

/** Fake repository for unit tests; mirrors the scoping rules of the pg implementation. */
export class InMemoryMenuRepository implements MenuRepository {
  readonly audit: (AuditEntry & { actorSub: string; tenantId: string })[] = [];
  private restaurants = new Map<
    string,
    { tenantId: string; name: string; currency: string; managers: Set<string> }
  >();
  private sections: SectionRow[] = [];
  private items: ItemRow[] = [];

  seedRestaurant(id: string, tenantId: string, name: string, currency: string, managers: string[]) {
    this.restaurants.set(id, { tenantId, name, currency, managers: new Set(managers) });
  }

  itemCount() {
    return this.items.length;
  }

  private restaurantFor(caller: Caller, restaurantId: string) {
    const r = this.restaurants.get(restaurantId);
    return r && r.tenantId === caller.tenantId ? r : undefined;
  }

  private log(caller: Caller, entry: AuditEntry) {
    this.audit.push({ ...entry, actorSub: caller.sub, tenantId: caller.tenantId });
  }

  private section(caller: Caller, restaurantId: string, sectionId: string) {
    return this.sections.find(
      (s) => s.id === sectionId && s.restaurantId === restaurantId && s.tenantId === caller.tenantId,
    );
  }

  private item(caller: Caller, restaurantId: string, itemId: string) {
    return this.items.find(
      (i) => i.id === itemId && i.restaurantId === restaurantId && i.tenantId === caller.tenantId,
    );
  }

  private view(i: ItemRow): MenuItem {
    return { id: i.id, name: i.name, description: i.description, price: i.price };
  }

  async isManager(caller: Caller, restaurantId: string) {
    return !!this.restaurantFor(caller, restaurantId)?.managers.has(caller.sub);
  }

  async getMenu(restaurantId: string): Promise<Menu | null> {
    const r = this.restaurants.get(restaurantId);
    if (!r) return null;
    return {
      restaurant: { id: restaurantId, name: r.name, currency: r.currency },
      sections: this.sections
        .filter((s) => s.restaurantId === restaurantId)
        .map((s) => ({
          id: s.id,
          name: s.name,
          items: this.items.filter((i) => i.sectionId === s.id).map((i) => this.view(i)),
        })),
    };
  }

  async addSection(caller: Caller, restaurantId: string, name: string): Promise<MenuSection> {
    const row = { id: randomUUID(), tenantId: caller.tenantId, restaurantId, name };
    this.sections.push(row);
    this.log(caller, { action: 'create', entity: 'menu_section', entityId: row.id });
    return { id: row.id, name, items: [] };
  }

  async renameSection(caller: Caller, restaurantId: string, sectionId: string, name: string) {
    const s = this.section(caller, restaurantId, sectionId);
    if (!s) return null;
    s.name = name;
    this.log(caller, { action: 'update', entity: 'menu_section', entityId: s.id });
    return { id: s.id, name, items: this.items.filter((i) => i.sectionId === s.id).map((i) => this.view(i)) };
  }

  async removeSection(
    caller: Caller,
    restaurantId: string,
    sectionId: string,
  ): Promise<RemoveSectionResult> {
    const s = this.section(caller, restaurantId, sectionId);
    if (!s) return 'not-found';
    if (this.items.some((i) => i.sectionId === s.id)) return 'has-items';
    this.sections = this.sections.filter((x) => x !== s);
    this.log(caller, { action: 'delete', entity: 'menu_section', entityId: s.id });
    return 'removed';
  }

  async addItem(
    caller: Caller,
    restaurantId: string,
    sectionId: string,
    item: { name: string; description: string; price: string },
  ) {
    if (!this.section(caller, restaurantId, sectionId)) return null;
    const row: ItemRow = {
      id: randomUUID(),
      tenantId: caller.tenantId,
      restaurantId,
      sectionId,
      ...item,
    };
    this.items.push(row);
    this.log(caller, { action: 'create', entity: 'menu_item', entityId: row.id });
    return this.view(row);
  }

  async updateItem(
    caller: Caller,
    restaurantId: string,
    itemId: string,
    patch: { name?: string; description?: string; price?: string },
  ) {
    const i = this.item(caller, restaurantId, itemId);
    if (!i) return null;
    Object.assign(i, patch);
    this.log(caller, { action: 'update', entity: 'menu_item', entityId: i.id });
    return this.view(i);
  }

  async removeItem(caller: Caller, restaurantId: string, itemId: string) {
    const i = this.item(caller, restaurantId, itemId);
    if (!i) return false;
    this.items = this.items.filter((x) => x !== i);
    this.log(caller, { action: 'delete', entity: 'menu_item', entityId: i.id });
    return true;
  }
}
