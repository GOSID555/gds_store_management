import { and, eq, inArray, sql } from 'drizzle-orm';
import { MUTATION_ROLES, computeSaleTotals, type Mutation, type MutationResult } from '@pos/shared';
import type { Db, Tx } from '../../db/client';
import { nextSeq, processedMutations, products, saleItems, sales, shopSettings, stockMovements } from '../../db/schema';
import type { AuthUser } from '../auth/plugin';

/** ข้อผิดพลาดทางธุรกิจ: mutation ถูกปฏิเสธถาวร client ไม่ต้อง retry */
export class DomainError extends Error {}

/** ล็อกเดียวสำหรับการเขียนทุกครั้ง ทำให้ seq ถูก commit ตามลำดับ → pull ไม่มีวันข้ามแถว */
const WRITE_LOCK = 7_001;

const roleRank = { cashier: 1, owner: 2 } as const;

export async function applyMutations(db: Db, user: AuthUser, mutations: Mutation[]): Promise<MutationResult[]> {
  const results: MutationResult[] = [];
  for (const m of mutations) {
    results.push(
      await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(${WRITE_LOCK})`);

        const [seen] = await tx.select().from(processedMutations).where(eq(processedMutations.mid, m.mid)).limit(1);
        if (seen) return { mid: m.mid, status: 'duplicate' as const };

        const record = (status: 'applied' | 'rejected', error?: string) =>
          tx.insert(processedMutations).values({ mid: m.mid, type: m.type, userId: user.id, deviceId: m.deviceId, status, error });

        if (roleRank[user.role] < roleRank[MUTATION_ROLES[m.type]]) {
          const error = 'สิทธิ์ไม่พอสำหรับการทำรายการนี้';
          await record('rejected', error);
          return { mid: m.mid, status: 'rejected' as const, error };
        }

        try {
          // savepoint: ถ้า handler ล้ม เฉพาะงานของ handler ถูก rollback แต่ยังบันทึกว่า rejected ได้
          await tx.transaction((sp) => handlers[m.type](sp, m as never, user));
          await record('applied');
          return { mid: m.mid, status: 'applied' as const };
        } catch (e) {
          if (!(e instanceof DomainError)) throw e;
          await record('rejected', e.message);
          return { mid: m.mid, status: 'rejected' as const, error: e.message };
        }
      }),
    );
  }
  return results;
}

type Handler<T extends Mutation['type']> = (tx: Tx, m: Extract<Mutation, { type: T }>, user: AuthUser) => Promise<void>;

async function moveStock(
  tx: Tx,
  rows: { productId: string; delta: number; reason: 'sale' | 'void' | 'receive' | 'adjust' | 'waste'; refId?: string; note?: string }[],
  user: AuthUser,
  deviceId: string,
) {
  if (!rows.length) return;
  await tx.insert(stockMovements).values(rows.map((r) => ({ ...r, userId: user.id, deviceId })));
  for (const r of rows) {
    await tx
      .update(products)
      .set({ stock: sql`${products.stock} + ${r.delta}`, seq: nextSeq, updatedAt: sql`now()` })
      .where(eq(products.id, r.productId));
  }
}

const handlers: { [K in Mutation['type']]: Handler<K> } = {
  async 'product.upsert'(tx, { payload: p }) {
    const values = { name: p.name, category: p.category, sku: p.sku || null, price: p.price, cost: p.cost, lowStock: p.lowStock, image: p.image || null, archived: p.archived };
    await tx
      .insert(products)
      .values({ id: p.id, ...values, seq: nextSeq })
      .onConflictDoUpdate({ target: products.id, set: { ...values, seq: nextSeq, updatedAt: sql`now()` } });
  },

  async 'product.archive'(tx, { payload }) {
    const r = await tx.update(products).set({ archived: true, seq: nextSeq, updatedAt: sql`now()` }).where(eq(products.id, payload.productId)).returning({ id: products.id });
    if (!r.length) throw new DomainError('ไม่พบสินค้า');
  },

  async 'stock.adjust'(tx, m, user) {
    const [p] = await tx.select({ id: products.id }).from(products).where(eq(products.id, m.payload.productId));
    if (!p) throw new DomainError('ไม่พบสินค้า');
    await moveStock(tx, [{ productId: p.id, delta: m.payload.delta, reason: m.payload.reason, note: m.payload.note }], user, m.deviceId);
  },

  /**
   * บิลที่ขายไปแล้วต้องรับเสมอ แม้สต็อกจะติดลบ (ของถูกส่งให้ลูกค้าไปแล้วจริง)
   * สต็อกติดลบคือสัญญาณให้เจ้าของร้านตรวจนับ ไม่ใช่เหตุให้ทิ้งบิล
   */
  async 'sale.create'(tx, m, user) {
    const s = m.payload;
    const [exists] = await tx.select({ id: sales.id }).from(sales).where(eq(sales.id, s.id));
    if (exists) return;

    const ids = [...new Set(s.items.map((i) => i.productId))];
    const found = await tx.select({ id: products.id }).from(products).where(inArray(products.id, ids));
    if (found.length !== ids.length) throw new DomainError('บิลมีสินค้าที่ไม่อยู่ในระบบ');

    const totals = computeSaleTotals(s.items, s.discount, s.received);
    if (s.method === 'cash' && s.received < totals.total) throw new DomainError('รับเงินไม่ครบยอด');

    await tx.insert(sales).values({
      id: s.id,
      billNo: s.billNo,
      deviceId: m.deviceId,
      userId: user.id,
      ...totals,
      method: s.method,
      received: s.method === 'cash' ? s.received : totals.total,
      change: s.method === 'cash' ? totals.change : 0,
      createdAt: s.createdAt,
      seq: nextSeq,
    });
    await tx.insert(saleItems).values(s.items.map((i) => ({ saleId: s.id, ...i })));
    await moveStock(tx, s.items.map((i) => ({ productId: i.productId, delta: -i.qty, reason: 'sale' as const, refId: s.id })), user, m.deviceId);
  },

  async 'sale.void'(tx, m, user) {
    const [s] = await tx
      .update(sales)
      .set({ status: 'voided', voidedAt: sql`now()`, seq: nextSeq })
      .where(and(eq(sales.id, m.payload.saleId), eq(sales.status, 'completed')))
      .returning({ id: sales.id });
    if (!s) throw new DomainError('ไม่พบบิล หรือบิลถูกยกเลิกไปแล้ว');
    const items = await tx.select().from(saleItems).where(eq(saleItems.saleId, s.id));
    await moveStock(tx, items.map((i) => ({ productId: i.productId, delta: i.qty, reason: 'void' as const, refId: s.id })), user, m.deviceId);
  },

  async 'settings.update'(tx, { payload }) {
    await tx
      .insert(shopSettings)
      .values({ id: 1, ...payload, seq: nextSeq })
      .onConflictDoUpdate({ target: shopSettings.id, set: { ...payload, seq: nextSeq } });
  },
};
