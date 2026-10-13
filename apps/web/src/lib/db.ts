import Dexie, { type Table } from 'dexie';
import type { Mutation, Product, Sale, ShopSettings } from '@pos/shared';

/**
 * ฐานข้อมูลในเครื่อง (IndexedDB) — หน้าจอทุกหน้าอ่านจากที่นี่เท่านั้น
 * จึงใช้งานได้เหมือนเดิมแม้เน็ตหลุด
 *
 * products / sales : สำเนาจาก server (server เป็นผู้ตัดสินค่าสุดท้าย)
 * outbox           : mutation ที่ยังไม่ได้ส่งขึ้น server เรียงตามลำดับที่เกิด
 */
export type LocalSale = Sale & { pending?: 1; rejected?: string };
export type OutboxItem = { id?: number; mutation: Mutation; attempts: number; lastError?: string };
export type Meta =
  | { key: 'cursor'; value: number }
  | { key: 'settings'; value: Omit<ShopSettings, 'seq'> }
  | { key: 'billCounter'; value: { day: string; n: number } }
  | { key: 'syncErrors'; value: { at: string; type: string; error: string }[] };

class PosDB extends Dexie {
  products!: Table<Product, string>;
  sales!: Table<LocalSale, string>;
  outbox!: Table<OutboxItem, number>;
  meta!: Table<Meta, string>;

  constructor() {
    super('pos');
    this.version(1).stores({
      products: 'id, category, sku, seq',
      sales: 'id, createdAt, seq',
      outbox: '++id',
      meta: 'key',
    });
  }
}

export const db = new PosDB();

type MetaValue = { [M in Meta as M['key']]: M['value'] };

export async function getMeta<K extends Meta['key']>(key: K): Promise<MetaValue[K] | undefined> {
  return (await db.meta.get(key))?.value as MetaValue[K] | undefined;
}
export const setMeta = (m: Meta) => db.meta.put(m);
