/** ตั้งรหัสผ่านบัญชี OWNER_USERNAME ใหม่ตาม OWNER_PASSWORD ใน .env (ใช้ตอนลืมรหัส): npm run db:reset-owner */
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { ensureOwner } from './bootstrap';
import { createDb } from './db/client';
import { users } from './db/schema';
import { loadEnv } from './env';

const env = loadEnv();
if (!env.OWNER_PASSWORD) throw new Error('ตั้ง OWNER_PASSWORD ใน .env ก่อน');
const username = env.OWNER_USERNAME.toLowerCase();
const { db, close } = await createDb(env.DATABASE_URL);
if (!(await ensureOwner(db, username, env.OWNER_PASSWORD))) {
  const r = await db
    .update(users)
    .set({ passwordHash: await bcrypt.hash(env.OWNER_PASSWORD, 10), role: 'owner' })
    .where(eq(users.username, username))
    .returning({ id: users.id });
  if (!r.length) await db.insert(users).values({ name: 'เจ้าของร้าน', username, passwordHash: await bcrypt.hash(env.OWNER_PASSWORD, 10), role: 'owner' });
}
console.log(`ตั้งรหัสผ่านของ "${username}" ตาม .env แล้ว`);
await close();
