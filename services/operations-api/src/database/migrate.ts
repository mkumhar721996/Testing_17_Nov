import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';

export interface MigrationDb {
  query(sql: string, params?: unknown[]): Promise<{ rows: any[] }>;
}

/** Applies the `.sql` files in `dir` in filename order, skipping ones already recorded. */
export async function applyMigrations(db: MigrationDb, dir: string): Promise<string[]> {
  await db.query('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())');
  const done = new Set((await db.query('select name from schema_migrations')).rows.map((r) => r.name as string));
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const applied: string[] = [];
  for (const file of files) {
    if (done.has(file)) continue;
    await db.query(readFileSync(join(dir, file), 'utf8'));
    await db.query('insert into schema_migrations (name) values ($1)', [file]);
    applied.push(file);
  }
  return applied;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const applied = await applyMigrations(pool, join(__dirname, '..', '..', 'migrations'));
    console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'No pending migrations');
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
