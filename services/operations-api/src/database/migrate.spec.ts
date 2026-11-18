import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyMigrations, type MigrationDb } from './migrate';

function fakeDb() {
  const applied = new Set<string>();
  const executed: string[] = [];
  const db: MigrationDb = {
    async query(sql: string, params?: unknown[]) {
      if (/select name from schema_migrations/.test(sql)) {
        return { rows: [...applied].map((name) => ({ name })) };
      }
      if (/insert into schema_migrations/.test(sql)) {
        applied.add(String(params?.[0]));
        return { rows: [] };
      }
      executed.push(sql);
      return { rows: [] };
    },
  };
  return { db, executed };
}

function migrationsDir(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'migrations-'));
  for (const [name, sql] of Object.entries(files)) writeFileSync(join(dir, name), sql);
  return dir;
}

describe('applyMigrations', () => {
  it('applies the SQL files in filename order', async () => {
    const dir = migrationsDir({ '002_b.sql': 'select 2', '001_a.sql': 'select 1' });
    const { db, executed } = fakeDb();
    const applied = await applyMigrations(db, dir);
    expect(applied).toEqual(['001_a.sql', '002_b.sql']);
    expect(executed.filter((s) => /^select \d$/.test(s))).toEqual(['select 1', 'select 2']);
  });

  it('is a no-op the second time', async () => {
    const dir = migrationsDir({ '001_a.sql': 'select 1' });
    const { db, executed } = fakeDb();
    await applyMigrations(db, dir);
    const again = await applyMigrations(db, dir);
    expect(again).toEqual([]);
    expect(executed.filter((s) => s === 'select 1')).toHaveLength(1);
  });
});
