import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'migrations');

/** Applies each pending migrations/NNNN_*.sql file once, in name order. Safe to re-run. */
export async function migrate(pool: Pool) {
  await pool.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+_.*\.sql$/.test(f) && !f.endsWith('.down.sql'))
    .sort();
  for (const file of files) {
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      // The lock makes concurrent runners wait, then see the file as applied.
      await db.query('SELECT pg_advisory_xact_lock(7014)');
      const done = await db.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
      if (!done.rowCount) {
        await db.query(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
        await db.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        console.log(`applied ${file}`);
      }
      await db.query('COMMIT');
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    } finally {
      db.release();
    }
  }
}

if (require.main === module) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  migrate(pool)
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
