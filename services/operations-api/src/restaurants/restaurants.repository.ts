import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export type Fulfilment = 'delivery' | 'pickup';

export interface RestaurantRecord {
  id: string;
  name: string;
  address: string;
  deliveryRadiusKm: number | null;
}

@Injectable()
export class RestaurantsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findRestaurant(tenantId: string, id: string): Promise<RestaurantRecord | null> {
    const { rows } = await this.pool.query(
      `SELECT id, name, address, delivery_radius_km AS "deliveryRadiusKm"
         FROM restaurants WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
    );
    return rows[0] ?? null;
  }

  async isManager(tenantId: string, restaurantId: string, userId: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `SELECT 1 FROM restaurant_managers
        WHERE tenant_id = $1 AND restaurant_id = $2 AND user_id = $3`,
      [tenantId, restaurantId, userId],
    );
    return (rowCount ?? 0) > 0;
  }

  // The update and its audit entry commit together (ADR-0011).
  async saveDeliveryRadius(
    tenantId: string,
    id: string,
    km: number,
    actorId: string,
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'UPDATE restaurants SET delivery_radius_km = $3 WHERE tenant_id = $1 AND id = $2',
        [tenantId, id, km],
      );
      await client.query(
        `INSERT INTO audit_log (tenant_id, actor_id, action, entity, entity_id, detail)
         VALUES ($1, $2, 'delivery_radius.set', 'restaurant', $3, $4)`,
        [tenantId, actorId, id, JSON.stringify({ deliveryRadiusKm: km })],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async list(tenantId: string, fulfilment: Fulfilment): Promise<Array<{ id: string; name: string }>> {
    const onlyDelivering = fulfilment === 'delivery' ? 'AND delivery_radius_km IS NOT NULL' : '';
    const { rows } = await this.pool.query(
      `SELECT id, name FROM restaurants WHERE tenant_id = $1 ${onlyDelivering} ORDER BY name`,
      [tenantId],
    );
    return rows;
  }
}
