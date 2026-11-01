import Dexie from 'dexie';
import { SAMPLE_MENU, computeSaleTotals, type Mutation, type PaymentMethod, type Product, type SaleItem } from '@pos/shared';
import { db, getMeta, setMeta, type LocalSale } from './db';
import { deviceCode, getDeviceId, isLocalMode, session } from './session';
import { syncNow } from './sync/engine';

/**
 * ทุกการกระทำของผู้ใช้ผ่านที่นี่: (1) แก้ข้อมูลในเครื่องทันที (optimistic) (2) ต่อคิว outbox
 * ทั้งสองอย่างอยู่ใน transaction เดียว — ไม่มีทางที่หน้าจอเปลี่ยนแต่คิวหาย
 * สต็อกที่ค้างส่งไม่ได้เขียนทับ product.stock แต่คำนวณสดจาก outbox (ดู usePendingStock)
 */
type Draft<T extends Mutation['type']> = Pick<Extract<Mutation, { type: T }>, 'type' | 'payload'>;

async function enqueue<T extends Mutation['type']>(draft: Draft<T>, local?: () => Promise<unknown>) {
  const mutation = { ...draft, mid: crypto.randomUUID(), deviceId: getDeviceId(), at: new Date().toISOString() } as Mutation;
  await db.transaction('rw', [db.outbox, db.products, db.sales, db.meta], async () => {
    await local?.();
    // โหมดเก็บในเครื่อง: ไม่มีเซิร์ฟเวอร์มาคำนวณสต็อกให้ จึงเขียนผลลงตารางในเครื่องเลย ไม่ต่อคิว
    if (isLocalMode()) await applyLocally(mutation);
    else await db.outbox.add({ mutation, attempts: 0 });
  });
  if (isLocalMode()) return mutation;
  // อย่าให้ sync เริ่มภายใน transaction ของ Dexie (จะผูกกับ transaction ที่กำลังจะปิด)
  Dexie.ignoreTransaction(() => setTimeout(() => void syncNow(), 0));
  return mutation;
}

/** ผลที่ฝั่ง server จะทำ สำหรับโหมดไม่มีเซิร์ฟเวอร์ (สต็อก + สถานะบิล) */
async function applyLocally(m: Mutation) {
  const move = (productId: string, delta: number) => db.products.where('id').equals(productId).modify((p) => void (p.stock += delta));
  switch (m.type) {
    case 'stock.adjust':
      return move(m.payload.productId, m.payload.delta);
    case 'sale.create':
      await db.sales.update(m.payload.id, { pending: undefined });
      for (const i of m.payload.items) await move(i.productId, -i.qty);
      return;
    case 'sale.void': {
      const sale = await db.sales.get(m.payload.saleId);
      for (const i of sale?.items ?? []) await move(i.productId, i.qty);
      return;
    }
  }
}

export type ProductInput = Omit<Product, 'stock' | 'updatedAt' | 'seq'>;

export const actions = {
  saveProduct(p: ProductInput, initialStock = 0) {
    return db.transaction('rw', [db.outbox, db.products, db.sales, db.meta], async () => {
      await enqueue({ type: 'product.upsert', payload: p }, async () => {
        const prev = await db.products.get(p.id);
        await db.products.put({ ...p, stock: prev?.stock ?? 0, seq: prev?.seq ?? 0, updatedAt: new Date().toISOString() });
      });
      if (initialStock) await actions.adjustStock(p.id, initialStock, 'receive', 'ยอดตั้งต้น');
    });
  },

  /** ใส่เมนูตัวอย่างร้านชานม 20 รายการ (ข้ามรายการที่มีอยู่แล้ว) คืนจำนวนที่เพิ่ม */
  async loadSampleMenu(): Promise<number> {
    const have = await db.products.bulkGet(SAMPLE_MENU.map((m) => m.id));
    let added = 0;
    for (const [i, m] of SAMPLE_MENU.entries()) {
      if (have[i]) continue;
      await actions.saveProduct(
        { id: m.id, name: m.name, category: m.category, sku: m.sku, price: m.price * 100, cost: m.cost * 100, lowStock: m.lowStock, image: null, archived: false },
        m.stock,
      );
      added++;
    }
    return added;
  },

  archiveProduct: (productId: string) =>
    enqueue({ type: 'product.archive', payload: { productId } }, () => db.products.update(productId, { archived: true })),

  adjustStock: (productId: string, delta: number, reason: 'receive' | 'adjust' | 'waste', note?: string) =>
    enqueue({ type: 'stock.adjust', payload: { productId, delta, reason, note } }),

  async createSale(items: SaleItem[], discount: number, method: PaymentMethod, received: number): Promise<LocalSale> {
    const createdAt = new Date().toISOString();
    const billNo = await nextBillNo();
    const totals = computeSaleTotals(items, discount, received);
    const recv = method === 'cash' ? received : totals.total;
    const sale: LocalSale = {
      id: crypto.randomUUID(),
      billNo,
      deviceId: getDeviceId(),
      userId: session.get()?.user.id ?? null,
      items,
      ...totals,
      method,
      received: recv,
      change: method === 'cash' ? totals.change : 0,
      status: 'completed',
      createdAt,
      seq: 0,
      pending: 1,
    };
    await enqueue({ type: 'sale.create', payload: { id: sale.id, billNo, items, discount: totals.discount, method, received: recv, createdAt } }, () => db.sales.put(sale));
    return sale;
  },

  voidSale: (saleId: string) => enqueue({ type: 'sale.void', payload: { saleId } }, () => db.sales.update(saleId, { status: 'voided' })),

  saveSettings: (s: { name: string; address: string; phone: string; promptPayId: string }) =>
    enqueue({ type: 'settings.update', payload: s }, () => setMeta({ key: 'settings', value: s })),
};

/** เลขที่บิล: <รหัสเครื่อง>-<ปีเดือนวัน>-<ลำดับในวัน> ไม่ชนกันข้ามเครื่องแม้ออฟไลน์ */
async function nextBillNo() {
  const d = new Date();
  const day = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return db.transaction('rw', db.meta, async () => {
    const c = await getMeta('billCounter');
    const n = c?.day === day ? c.n + 1 : 1;
    await setMeta({ key: 'billCounter', value: { day, n } });
    return `${deviceCode()}-${day}-${String(n).padStart(3, '0')}`;
  });
}
