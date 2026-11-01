import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import type { Db } from './db/client';
import { users } from './db/schema';

export const GUEST_USERNAME = '__guest__';

/** ครั้งแรกที่ระบบยังไม่มีผู้ใช้ สร้างบัญชีเจ้าของร้านจาก env */
export async function ensureOwner(db: Db, username: string, password: string | undefined) {
  const [{ n }] = (await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(sql`${users.username} <> ${GUEST_USERNAME}`)) as [{ n: number }];
  if (n > 0) return null;
  if (!password) throw new Error('ยังไม่มีผู้ใช้ในระบบ: ตั้ง OWNER_PASSWORD ใน .env เพื่อสร้างบัญชีเจ้าของร้าน');
  await db.insert(users).values({ name: 'เจ้าของร้าน', username: username.toLowerCase(), passwordHash: await bcrypt.hash(password, 10), role: 'owner' });
  return username;
}

/** บัญชีกลางของโหมดทดลอง (ไม่มีรหัสผ่านที่ใช้ได้ เข้าได้ผ่าน /auth/guest เท่านั้น) */
export async function ensureGuest(db: Db) {
  await db
    .insert(users)
    .values({ name: 'ผู้ทดลองใช้', username: GUEST_USERNAME, passwordHash: '!disabled', role: 'owner' })
    .onConflictDoNothing({ target: users.username });
  const [u] = await db.select({ id: users.id, name: users.name, role: users.role, username: users.username }).from(users).where(sql`${users.username} = ${GUEST_USERNAME}`);
  return u!;
}
