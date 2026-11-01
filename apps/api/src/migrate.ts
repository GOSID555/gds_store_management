/**
 * รันตอน deploy (Vercel build): อัปเดตตารางให้ตรง schema และสร้างบัญชีเจ้าของร้านถ้ายังไม่มี
 * ไม่มี DATABASE_URL = ข้าม (เช่น preview build ที่ยังไม่ได้ผูกฐานข้อมูล)
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureOwner } from './bootstrap';
import { createDb } from './db/client';
import { databaseUrlFromEnv } from './env';

const url = databaseUrlFromEnv();
if (!url) {
  console.log('migrate: ไม่มี DATABASE_URL ข้ามการ migrate');
  process.exit(0);
}
const here = path.dirname(fileURLToPath(import.meta.url));
const { db, close } = await createDb(url, { migrationsFolder: path.resolve(here, '../drizzle'), poolMax: 1 });
console.log('migrate: schema อัปเดตแล้ว');
// โหมดทดลอง (ไม่ได้ตั้ง REQUIRE_LOGIN=true) ไม่บังคับให้มีบัญชีเจ้าของร้าน
if (process.env.REQUIRE_LOGIN === 'true' || process.env.OWNER_PASSWORD) {
  const owner = await ensureOwner(db, process.env.OWNER_USERNAME ?? 'owner', process.env.OWNER_PASSWORD);
  if (owner) console.log(`migrate: สร้างบัญชีเจ้าของร้าน "${owner}" แล้ว`);
}
await close();
