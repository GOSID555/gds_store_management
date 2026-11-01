/** ใส่สินค้าตัวอย่างสำหรับทดลองระบบ: npm run db:seed */
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { SAMPLE_MENU, type Mutation } from '@pos/shared';
import { ensureOwner } from './bootstrap';
import { createDb } from './db/client';
import { products, users } from './db/schema';
import { loadEnv } from './env';
import { applyMutations } from './modules/sync/apply';

const env = loadEnv();
const { db, close } = await createDb(env.DATABASE_URL);
await ensureOwner(db, env.OWNER_USERNAME, env.OWNER_PASSWORD);
const [owner] = await db.select().from(users).where(eq(users.role, 'owner')).limit(1);
if (!owner) throw new Error('ไม่พบบัญชีเจ้าของร้าน');

const at = new Date().toISOString();
const base = { deviceId: 'seed', at };
const mutations: Mutation[] = [
  { ...base, mid: randomUUID(), type: 'settings.update', payload: { name: 'ชานมไข่มุก', address: '', phone: '', promptPayId: '' } },
];
// เมนูตัวอย่างร้านชานม 20 รายการ (id คงที่ → รันซ้ำไม่สร้างซ้ำ ไม่เติมสต็อกซ้ำ)
const existing = new Set((await db.select({ id: products.id }).from(products)).map((r) => r.id));
for (const { id, name, category, sku, price, cost, stock, lowStock } of SAMPLE_MENU) {
  if (existing.has(id)) continue;
  mutations.push({ ...base, mid: randomUUID(), type: 'product.upsert', payload: { id, name, category, sku, price: price * 100, cost: cost * 100, lowStock, image: null, archived: false } });
  if (stock) mutations.push({ ...base, mid: randomUUID(), type: 'stock.adjust', payload: { productId: id, delta: stock, reason: 'receive', note: 'ยอดตั้งต้น' } });
}

const results = await applyMutations(db, { id: owner.id, name: owner.name, role: 'owner' }, mutations);
console.log(`seed: ${results.filter((r) => r.status === 'applied').length}/${results.length} applied`);
await close();
