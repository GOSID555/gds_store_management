import { useLiveQuery } from 'dexie-react-hooks';
import type { Product } from '@pos/shared';
import { db, getMeta } from './db';

/** สต็อกที่ยังค้างใน outbox: ขาย/รับเข้า/ยกเลิกบิล ที่ server ยังไม่ยืนยัน */
async function pendingStockDeltas(): Promise<Map<string, number>> {
  const outbox = await db.outbox.toArray();
  const deltas = new Map<string, number>();
  const add = (id: string, d: number) => deltas.set(id, (deltas.get(id) ?? 0) + d);
  const voidIds = outbox.flatMap((o) => (o.mutation.type === 'sale.void' ? [o.mutation.payload.saleId] : []));
  const voided = new Map((await db.sales.bulkGet(voidIds)).flatMap((s) => (s ? [[s.id, s] as const] : [])));

  for (const { mutation: m } of outbox) {
    if (m.type === 'stock.adjust') add(m.payload.productId, m.payload.delta);
    else if (m.type === 'sale.create') m.payload.items.forEach((i) => add(i.productId, -i.qty));
    else if (m.type === 'sale.void') voided.get(m.payload.saleId)?.items.forEach((i) => add(i.productId, i.qty));
  }
  return deltas;
}

/** สินค้าพร้อมสต็อกที่หน้าจอควรแสดง = ค่าจาก server + ส่วนที่ค้างส่ง */
export function useProducts(): Product[] | undefined {
  return useLiveQuery(async () => {
    const [ps, deltas] = await Promise.all([db.products.toArray(), pendingStockDeltas()]);
    return ps
      .filter((p) => !p.archived)
      .map((p) => ({ ...p, stock: p.stock + (deltas.get(p.id) ?? 0) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'th'));
  });
}

export const useSalesSince = (sinceIso: string) =>
  useLiveQuery(() => db.sales.where('createdAt').aboveOrEqual(sinceIso).reverse().sortBy('createdAt'), [sinceIso]);

export const useSettings = () => useLiveQuery(async () => (await getMeta('settings')) ?? { name: 'ร้านของฉัน', address: '', phone: '', promptPayId: '' });
export const usePendingCount = () => useLiveQuery(() => db.outbox.count(), [], 0);
export const useSyncErrors = () => useLiveQuery(async () => (await getMeta('syncErrors')) ?? [], [], []);

export type StockState = 'ok' | 'low' | 'out';
export const stockState = (p: Pick<Product, 'stock' | 'lowStock'>): StockState => (p.stock <= 0 ? 'out' : p.stock <= p.lowStock ? 'low' : 'ok');
