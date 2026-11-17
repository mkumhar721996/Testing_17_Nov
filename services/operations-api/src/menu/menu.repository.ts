export interface Caller {
  sub: string;
  tenantId: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: string;
}

export interface MenuSection {
  id: string;
  name: string;
  items: MenuItem[];
}

export interface Menu {
  restaurant: { id: string; name: string; currency: string };
  sections: MenuSection[];
}

export interface AuditEntry {
  action: string;
  entity: string;
  entityId: string | null;
  detail?: Record<string, unknown>;
}

export type RemoveSectionResult = 'removed' | 'not-found' | 'has-items';

/**
 * Every method is scoped by tenant and restaurant; every write also appends one audit entry
 * in the same transaction. Ids that do not belong to the restaurant behave as not found.
 */
export interface MenuRepository {
  isManager(caller: Caller, restaurantId: string): Promise<boolean>;
  getMenu(restaurantId: string): Promise<Menu | null>;
  addSection(caller: Caller, restaurantId: string, name: string): Promise<MenuSection>;
  renameSection(
    caller: Caller,
    restaurantId: string,
    sectionId: string,
    name: string,
  ): Promise<MenuSection | null>;
  removeSection(
    caller: Caller,
    restaurantId: string,
    sectionId: string,
  ): Promise<RemoveSectionResult>;
  addItem(
    caller: Caller,
    restaurantId: string,
    sectionId: string,
    item: { name: string; description: string; price: string },
  ): Promise<MenuItem | null>;
  updateItem(
    caller: Caller,
    restaurantId: string,
    itemId: string,
    patch: { name?: string; description?: string; price?: string },
  ): Promise<MenuItem | null>;
  removeItem(caller: Caller, restaurantId: string, itemId: string): Promise<boolean>;
}

export const MENU_REPOSITORY = Symbol('MENU_REPOSITORY');
