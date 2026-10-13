import path from 'node:path';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const migrationsFolder = path.resolve(process.cwd(), 'drizzle');

/**
 * Production: PostgreSQL ผ่าน node-postgres
 * Dev/Test:   PGlite (Postgres ตัวจริงที่คอมไพล์เป็น WASM) — ไม่ต้องติดตั้งอะไรเพิ่ม
 * ทั้งสองแบบรัน migration ชุดเดียวกันตอนเปิดเซิร์ฟเวอร์
 */
export async function createDb(url?: string): Promise<{ db: Db; close: () => Promise<void> }> {
  if (!url || url.startsWith('pglite:')) {
    const { PGlite } = await import('@electric-sql/pglite');
    const { drizzle } = await import('drizzle-orm/pglite');
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    const target = url?.slice('pglite:'.length) || path.resolve(process.cwd(), '../../.pgdata');
    const client = target === 'memory' ? new PGlite() : new PGlite(target);
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder });
    return { db: db as unknown as Db, close: () => client.close() };
  }
  const { default: pg } = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const { migrate } = await import('drizzle-orm/node-postgres/migrator');
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  const db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder });
  return { db: db as unknown as Db, close: () => pool.end() };
}
