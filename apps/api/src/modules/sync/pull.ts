import { and, asc, gt, inArray, lte, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { PullResponse, Sale } from '@pos/shared';
import type { Db } from '../../db/client';
import { products, saleItems, sales, shopSettings } from '../../db/schema';

/** ส่งเวลาเป็น ISO-8601 UTC เสมอ เพื่อให้ client เรียง/เทียบเป็น string ได้ */
const iso = (t: string) => new Date(t.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00')).toISOString();

/**
 * คืนการเปลี่ยนแปลงทั้งหมดที่ seq อยู่ในช่วง (since, upper]
 * upper เลือกจาก seq ที่เล็กที่สุด `limit` ตัวรวมทุกตาราง ทำให้หน้าถัดไปไม่ข้ามแถวของตารางใด
 */
export async function pullChanges(db: Db, since: number, limit: number): Promise<PullResponse> {
  const res = await db.execute<{ seq: string | number }>(sql`
    select seq from (
      select seq from products where seq > ${since}
      union all select seq from sales where seq > ${since}
      union all select seq from shop_settings where seq > ${since}
    ) t order by seq limit ${limit}`);
  const rows = (res as unknown as { rows: { seq: string | number }[] }).rows;
  if (!rows.length) return { products: [], sales: [], settings: null, cursor: since, hasMore: false };

  const upper = Number(rows[rows.length - 1]!.seq);
  const range = (seq: AnyPgColumn) => and(gt(seq, since), lte(seq, upper));

  const [ps, ss, st] = await Promise.all([
    db.select().from(products).where(range(products.seq)).orderBy(asc(products.seq)),
    db.select().from(sales).where(range(sales.seq)).orderBy(asc(sales.seq)),
    db.select().from(shopSettings).where(range(shopSettings.seq)),
  ]);

  const items = ss.length ? await db.select().from(saleItems).where(inArray(saleItems.saleId, ss.map((s) => s.id))) : [];
  const bySale = new Map<string, Sale['items']>();
  for (const { saleId, id: _id, ...i } of items) (bySale.get(saleId) ?? bySale.set(saleId, []).get(saleId)!).push(i);

  return {
    products: ps.map((p) => ({ ...p, sku: p.sku ?? null, image: p.image ?? null, updatedAt: iso(p.updatedAt) })),
    sales: ss.map(({ syncedAt: _s, voidedAt: _v, ...s }) => ({ ...s, createdAt: iso(s.createdAt), items: bySale.get(s.id) ?? [] })),
    settings: st[0] ? { name: st[0].name, address: st[0].address, phone: st[0].phone, promptPayId: st[0].promptPayId, seq: st[0].seq } : null,
    cursor: upper,
    hasMore: rows.length === limit,
  };
}
