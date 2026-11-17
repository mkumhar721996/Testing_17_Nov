import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { PG_POOL } from '../database/database.module';
import {
  AuditEntry,
  Caller,
  Menu,
  MenuItem,
  MenuRepository,
  MenuSection,
  RemoveSectionResult,
} from './menu.repository';

const ITEM_COLUMNS = 'id, name, description, price::text AS price';

@Injectable()
export class PgMenuRepository implements MenuRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** Runs the write and its audit entry in one transaction. */
  private async write<T>(
    caller: Caller,
    work: (db: PoolClient, audit: (entry: AuditEntry) => Promise<void>) => Promise<T>,
  ): Promise<T> {
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      const audit = async (e: AuditEntry) => {
        await db.query(
          `INSERT INTO audit_log (tenant_id, actor_sub, action, entity, entity_id, detail)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [caller.tenantId, caller.sub, e.action, e.entity, e.entityId, e.detail ?? null],
        );
      };
      const result = await work(db, audit);
      await db.query('COMMIT');
      return result;
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    } finally {
      db.release();
    }
  }

  async isManager(caller: Caller, restaurantId: string) {
    const { rowCount } = await this.pool.query(
      `SELECT 1 FROM restaurant_managers
       WHERE tenant_id = $1 AND restaurant_id = $2 AND user_sub = $3`,
      [caller.tenantId, restaurantId, caller.sub],
    );
    return !!rowCount;
  }

  async getMenu(restaurantId: string): Promise<Menu | null> {
    const restaurant = await this.pool.query(
      'SELECT id, name, currency FROM restaurants WHERE id = $1',
      [restaurantId],
    );
    if (!restaurant.rowCount) return null;
    const sections = await this.pool.query<{ id: string; name: string }>(
      `SELECT id, name FROM menu_sections WHERE restaurant_id = $1 ORDER BY position, id`,
      [restaurantId],
    );
    const items = await this.pool.query<MenuItem & { section_id: string }>(
      `SELECT ${ITEM_COLUMNS}, section_id FROM menu_items
       WHERE restaurant_id = $1 ORDER BY position, id`,
      [restaurantId],
    );
    return {
      restaurant: restaurant.rows[0],
      sections: sections.rows.map((s) => ({
        ...s,
        items: items.rows
          .filter((i) => i.section_id === s.id)
          .map(({ section_id: _sectionId, ...item }) => item),
      })),
    };
  }

  addSection(caller: Caller, restaurantId: string, name: string): Promise<MenuSection> {
    return this.write(caller, async (db, audit) => {
      const { rows } = await db.query<{ id: string; name: string }>(
        `INSERT INTO menu_sections (id, tenant_id, restaurant_id, name, position)
         VALUES (gen_random_uuid(), $1, $2, $3,
           (SELECT COALESCE(MAX(position), 0) + 1 FROM menu_sections WHERE restaurant_id = $2))
         RETURNING id, name`,
        [caller.tenantId, restaurantId, name],
      );
      await audit({ action: 'create', entity: 'menu_section', entityId: rows[0].id, detail: { name } });
      return { ...rows[0], items: [] };
    });
  }

  renameSection(caller: Caller, restaurantId: string, sectionId: string, name: string) {
    return this.write(caller, async (db, audit) => {
      const { rows } = await db.query<{ id: string; name: string }>(
        `UPDATE menu_sections SET name = $4
         WHERE id = $1 AND restaurant_id = $2 AND tenant_id = $3 RETURNING id, name`,
        [sectionId, restaurantId, caller.tenantId, name],
      );
      if (!rows.length) return null;
      await audit({ action: 'update', entity: 'menu_section', entityId: sectionId, detail: { name } });
      const items = await db.query<MenuItem>(
        `SELECT ${ITEM_COLUMNS} FROM menu_items WHERE section_id = $1 AND tenant_id = $2
         ORDER BY position, id`,
        [sectionId, caller.tenantId],
      );
      return { ...rows[0], items: items.rows };
    });
  }

  removeSection(
    caller: Caller,
    restaurantId: string,
    sectionId: string,
  ): Promise<RemoveSectionResult> {
    return this.write(caller, async (db, audit) => {
      // Lock the section row so a concurrent item insert cannot slip in before the delete.
      const section = await db.query(
        `SELECT 1 FROM menu_sections WHERE id = $1 AND restaurant_id = $2 AND tenant_id = $3
         FOR UPDATE`,
        [sectionId, restaurantId, caller.tenantId],
      );
      if (!section.rowCount) return 'not-found';
      const items = await db.query(
        'SELECT 1 FROM menu_items WHERE section_id = $1 AND tenant_id = $2 LIMIT 1',
        [sectionId, caller.tenantId],
      );
      if (items.rowCount) return 'has-items';
      await db.query('DELETE FROM menu_sections WHERE id = $1 AND tenant_id = $2', [
        sectionId,
        caller.tenantId,
      ]);
      await audit({ action: 'delete', entity: 'menu_section', entityId: sectionId });
      return 'removed';
    });
  }

  addItem(
    caller: Caller,
    restaurantId: string,
    sectionId: string,
    item: { name: string; description: string; price: string },
  ) {
    return this.write(caller, async (db, audit) => {
      const section = await db.query(
        `SELECT 1 FROM menu_sections WHERE id = $1 AND restaurant_id = $2 AND tenant_id = $3
         FOR SHARE`,
        [sectionId, restaurantId, caller.tenantId],
      );
      if (!section.rowCount) return null;
      const { rows } = await db.query<MenuItem>(
        `INSERT INTO menu_items
           (id, tenant_id, restaurant_id, section_id, name, description, price, position)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6,
           (SELECT COALESCE(MAX(position), 0) + 1 FROM menu_items WHERE section_id = $3))
         RETURNING ${ITEM_COLUMNS}`,
        [caller.tenantId, restaurantId, sectionId, item.name, item.description, item.price],
      );
      await audit({ action: 'create', entity: 'menu_item', entityId: rows[0].id, detail: item });
      return rows[0];
    });
  }

  updateItem(
    caller: Caller,
    restaurantId: string,
    itemId: string,
    patch: { name?: string; description?: string; price?: string },
  ) {
    return this.write(caller, async (db, audit) => {
      const { rows } = await db.query<MenuItem>(
        `UPDATE menu_items SET
           name = COALESCE($4, name),
           description = COALESCE($5, description),
           price = COALESCE($6::numeric, price)
         WHERE id = $1 AND restaurant_id = $2 AND tenant_id = $3
         RETURNING ${ITEM_COLUMNS}`,
        [itemId, restaurantId, caller.tenantId, patch.name ?? null, patch.description ?? null, patch.price ?? null],
      );
      if (!rows.length) return null;
      await audit({ action: 'update', entity: 'menu_item', entityId: itemId, detail: patch });
      return rows[0];
    });
  }

  removeItem(caller: Caller, restaurantId: string, itemId: string) {
    return this.write(caller, async (db, audit) => {
      const { rowCount } = await db.query(
        'DELETE FROM menu_items WHERE id = $1 AND restaurant_id = $2 AND tenant_id = $3',
        [itemId, restaurantId, caller.tenantId],
      );
      if (!rowCount) return false;
      await audit({ action: 'delete', entity: 'menu_item', entityId: itemId });
      return true;
    });
  }
}
