import { z } from 'zod';
import { PaymentMethod, Product, Sale, SaleItem, ShopSettings } from './schemas';

/**
 * Sync protocol
 * -------------
 * PUSH: client ส่ง "mutation" (เจตนาของผู้ใช้) เป็นชุด ตามลำดับที่เกิดขึ้นจริง
 *       แต่ละ mutation มี `mid` (uuid) ที่ client สร้าง → server ใช้กันการประมวลผลซ้ำ (idempotent)
 * PULL: client ขอทุกแถวที่ `seq` > cursor ล่าสุด → server เป็นผู้ตัดสินค่าสุดท้ายเสมอ
 *
 * สต็อกไม่ได้ส่งเป็น "ค่าคงเหลือ" แต่ส่งเป็น "ส่วนต่าง" (delta) ลง ledger
 * ทำให้สองเครื่องขายของชิ้นเดียวกันตอนออฟไลน์แล้วซิงก์ทีหลังได้ยอดถูกต้องเสมอ
 */

const base = { mid: z.string().uuid(), deviceId: z.string().min(1), at: z.string() };

export const ProductUpsertPayload = Product.omit({ stock: true, updatedAt: true, seq: true });
export const SaleCreatePayload = z.object({
  id: z.string().uuid(),
  billNo: z.string().min(1).max(40),
  items: z.array(SaleItem).min(1).max(200),
  discount: z.number().int().nonnegative(),
  method: PaymentMethod,
  received: z.number().int().nonnegative(),
  createdAt: z.string(),
});

export const Mutation = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('product.upsert'), payload: ProductUpsertPayload }),
  z.object({ ...base, type: z.literal('product.archive'), payload: z.object({ productId: z.string().uuid() }) }),
  z.object({
    ...base,
    type: z.literal('stock.adjust'),
    payload: z.object({
      productId: z.string().uuid(),
      delta: z.number().int().refine((n) => n !== 0, 'delta ต้องไม่เป็น 0'),
      reason: z.enum(['receive', 'adjust', 'waste']),
      note: z.string().max(200).optional(),
    }),
  }),
  z.object({ ...base, type: z.literal('sale.create'), payload: SaleCreatePayload }),
  z.object({ ...base, type: z.literal('sale.void'), payload: z.object({ saleId: z.string().uuid() }) }),
  z.object({ ...base, type: z.literal('settings.update'), payload: ShopSettings.omit({ seq: true }) }),
]);
export type Mutation = z.infer<typeof Mutation>;
export type MutationType = Mutation['type'];

export const PushRequest = z.object({ mutations: z.array(Mutation).min(1).max(100) });
export type PushRequest = z.infer<typeof PushRequest>;

export type MutationResult =
  | { mid: string; status: 'applied' | 'duplicate' }
  | { mid: string; status: 'rejected'; error: string };
export type PushResponse = { results: MutationResult[] };

export type PullResponse = {
  products: Product[];
  sales: Sale[];
  settings: ShopSettings | null;
  cursor: number;
  hasMore: boolean;
};

/** สิทธิ์ขั้นต่ำของแต่ละ mutation */
export const MUTATION_ROLES: Record<MutationType, 'cashier' | 'owner'> = {
  'sale.create': 'cashier',
  'stock.adjust': 'cashier',
  'product.upsert': 'owner',
  'product.archive': 'owner',
  'sale.void': 'owner',
  'settings.update': 'owner',
};

/** ยอดของบิลคำนวณจากรายการเสมอ ทั้งสองฝั่งใช้ฟังก์ชันเดียวกัน */
export function computeSaleTotals(items: { price: number; qty: number }[], discount: number, received: number) {
  const subtotal = items.reduce((a, i) => a + i.price * i.qty, 0);
  const d = Math.min(discount, subtotal);
  const total = subtotal - d;
  return { subtotal, discount: d, total, change: Math.max(0, received - total) };
}
