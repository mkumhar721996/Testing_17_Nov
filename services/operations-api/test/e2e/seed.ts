import { Pool } from 'pg';

export const TENANT_A = '00000000-0000-4000-8000-0000000000a1';
export const TENANT_B = '00000000-0000-4000-8000-0000000000b1';
export const RESTAURANT_A = '00000000-0000-4000-8000-00000000a001';
export const RESTAURANT_B = '00000000-0000-4000-8000-00000000b001';

/** Fake-auth bearer tokens: "<sub>:<tenant>" (E2E_FAKE_AUTH=1). */
export const MANAGER_A = { Authorization: `Bearer manager-a:${TENANT_A}` };
export const MANAGER_B = { Authorization: `Bearer manager-b:${TENANT_B}` };
export const STRANGER_A = { Authorization: `Bearer stranger:${TENANT_A}` };

export const hasDatabase = !!process.env.DATABASE_URL;

/** Idempotent: two restaurants in different tenants with one manager each. */
export async function seed(pool: Pool) {
  await pool.query(
    `INSERT INTO restaurants (id, tenant_id, name, currency) VALUES
       ($1, $2, 'Bistro A', 'EUR'), ($3, $4, 'Bistro B', 'USD')
     ON CONFLICT DO NOTHING`,
    [RESTAURANT_A, TENANT_A, RESTAURANT_B, TENANT_B],
  );
  await pool.query(
    `INSERT INTO restaurant_managers (tenant_id, restaurant_id, user_sub) VALUES
       ($1, $2, 'manager-a'), ($3, $4, 'manager-b')
     ON CONFLICT DO NOTHING`,
    [TENANT_A, RESTAURANT_A, TENANT_B, RESTAURANT_B],
  );
}

/** Empties the menus (not the restaurants) so each test starts clean. */
export async function resetMenus(pool: Pool) {
  await pool.query('DELETE FROM menu_items');
  await pool.query('DELETE FROM menu_sections');
}
