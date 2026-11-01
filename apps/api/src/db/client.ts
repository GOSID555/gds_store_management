import path from 'node:path';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export type DbOptions = {
  /** รัน migration ตอนเชื่อมต่อ (dev/test) — บน Vercel รันตอน build แทน */
  migrate?: boolean;
  migrationsFolder?: string;
  /** serverless ควรใช้ pool เล็ก + connection string แบบ pooled ของ Neon */
  poolMax?: number;
};

/**
 * Production: PostgreSQL ผ่าน node-postgres
 * Dev/Test:   PGlite (Postgres ตัวจริงที่คอมไพล์เป็น WASM) — ไม่ต้องติดตั้งอะไรเพิ่ม
 * ทั้งสองแบบใช้ migration ชุดเดียวกัน (apps/api/drizzle)
 */
export async function createDb(url?: string, opts: DbOptions = {}): Promise<{ db: Db; close: () => Promise<void> }> {
  const { migrate: runMigrations = true, poolMax = 10 } = opts;
  const migrationsFolder = opts.migrationsFolder ?? process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), 'drizzle');
  if (!url || url.startsWith('pglite:')) {
    const { PGlite } = await import('@electric-sql/pglite');
    const { drizzle } = await import('drizzle-orm/pglite');
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    const target = url?.slice('pglite:'.length) || path.resolve(process.cwd(), '../../.pgdata');
    const client = target === 'memory' ? new PGlite() : new PGlite(target);
    const db = drizzle(client, { schema });
    if (runMigrations) await migrate(db, { migrationsFolder });
    return { db: db as unknown as Db, close: () => client.close() };
  }
  const { default: pg } = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const { migrate } = await import('drizzle-orm/node-postgres/migrator');
  const pool = new pg.Pool({ connectionString: url, max: poolMax });
  const db = drizzle(pool, { schema });
  if (runMigrations) await migrate(db, { migrationsFolder });
  return { db: db as unknown as Db, close: () => pool.end() };
}
