/** ใส่สินค้าตัวอย่างสำหรับทดลองระบบ: npm run db:seed */
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Mutation } from '@pos/shared';
import { ensureOwner } from './bootstrap';
import { createDb } from './db/client';
import { users } from './db/schema';
import { loadEnv } from './env';
import { applyMutations } from './modules/sync/apply';

const env = loadEnv();
const { db, close } = await createDb(env.DATABASE_URL);
await ensureOwner(db, env.OWNER_USERNAME, env.OWNER_PASSWORD);
const [owner] = await db.select().from(users).where(eq(users.role, 'owner')).limit(1);
if (!owner) throw new Error('ไม่พบบัญชีเจ้าของร้าน');

const samples: [string, string, number, number, number, number, string | null][] = [
  ['กาแฟเย็น', 'เครื่องดื่ม', 55, 18, 40, 10, '8850001000011'],
  ['ชาไทยเย็น', 'เครื่องดื่ม', 45, 14, 35, 10, '8850001000028'],
  ['น้ำดื่ม 600 มล.', 'เครื่องดื่ม', 10, 5, 120, 24, '8850001000035'],
  ['ข้าวกะเพราไก่', 'อาหาร', 60, 28, 20, 5, null],
  ['ขนมปังสังขยา', 'ขนม', 35, 12, 6, 8, null],
  ['คุกกี้เนยสด', 'ขนม', 25, 9, 0, 6, '8850001000042'],
  ['ถุงผ้า', 'ของใช้', 39, 15, 15, 5, null],
];

const at = new Date().toISOString();
const base = { deviceId: 'seed', at };
const mutations: Mutation[] = [
  { ...base, mid: randomUUID(), type: 'settings.update', payload: { name: 'ร้านของฉัน', address: '', phone: '', promptPayId: '' } },
];
for (const [name, category, price, cost, stock, lowStock, sku] of samples) {
  const id = randomUUID();
  mutations.push({ ...base, mid: randomUUID(), type: 'product.upsert', payload: { id, name, category, sku, price: price * 100, cost: cost * 100, lowStock, image: null, archived: false } });
  if (stock) mutations.push({ ...base, mid: randomUUID(), type: 'stock.adjust', payload: { productId: id, delta: stock, reason: 'receive', note: 'ยอดตั้งต้น' } });
}

const results = await applyMutations(db, { id: owner.id, name: owner.name, role: 'owner' }, mutations);
console.log(`seed: ${results.filter((r) => r.status === 'applied').length}/${results.length} applied`);
await close();
