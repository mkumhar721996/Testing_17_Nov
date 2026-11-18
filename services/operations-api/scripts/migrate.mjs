// Applies migrations/*.sql in filename order. Every file must be safe to re-run (IF NOT EXISTS).
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const dir = fileURLToPath(new URL('../migrations/', import.meta.url));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    await pool.query(await readFile(join(dir, file), 'utf8'));
    console.log(`applied ${file}`);
  }
} finally {
  await pool.end();
}
