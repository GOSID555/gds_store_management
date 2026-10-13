import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import type { Db } from './db/client';
import { users } from './db/schema';

/** ครั้งแรกที่ระบบยังไม่มีผู้ใช้ สร้างบัญชีเจ้าของร้านจาก env */
export async function ensureOwner(db: Db, username: string, password: string | undefined) {
  const [{ n }] = (await db.select({ n: sql<number>`count(*)::int` }).from(users)) as [{ n: number }];
  if (n > 0) return null;
  if (!password) throw new Error('ยังไม่มีผู้ใช้ในระบบ: ตั้ง OWNER_PASSWORD ใน .env เพื่อสร้างบัญชีเจ้าของร้าน');
  await db.insert(users).values({ name: 'เจ้าของร้าน', username: username.toLowerCase(), passwordHash: await bcrypt.hash(password, 10), role: 'owner' });
  return username;
}
