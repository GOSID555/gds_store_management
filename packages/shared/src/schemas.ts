import { z } from 'zod';

/** โมเดลข้อมูลที่ client และ server ใช้ร่วมกัน (ฝั่ง server เป็นตัวจริง) */

export const Role = z.enum(['owner', 'cashier']);
export type Role = z.infer<typeof Role>;

export const PaymentMethod = z.enum(['cash', 'transfer']);
export type PaymentMethod = z.infer<typeof PaymentMethod>;

/** ขนาดสูงสุดของ data URL รูปสินค้า (~60 KB) */
export const PRODUCT_IMAGE_MAX = 80_000;

export const Product = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().max(60).default('อื่นๆ'),
  sku: z.string().trim().max(64).nullable().default(null),
  price: z.number().int().nonnegative(), // สตางค์
  cost: z.number().int().nonnegative(), // สตางค์
  lowStock: z.number().int().nonnegative().default(5),
  /** รูปสินค้าย่อขนาดแล้ว เก็บเป็น data URL เพื่อให้ใช้ได้ออฟไลน์และซิงก์ไปพร้อมสินค้า */
  image: z.string().max(PRODUCT_IMAGE_MAX).regex(/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/).nullable().default(null),
  /** คงเหลือตามที่ server คำนวณจาก stock ledger — client ห้ามแก้ตรงๆ */
  stock: z.number().int(),
  archived: z.boolean().default(false),
  updatedAt: z.string(),
  seq: z.number().int(),
});
export type Product = z.infer<typeof Product>;

export const SaleItem = z.object({
  productId: z.string().uuid(),
  name: z.string(),
  price: z.number().int().nonnegative(),
  cost: z.number().int().nonnegative(),
  qty: z.number().int().positive(),
});
export type SaleItem = z.infer<typeof SaleItem>;

export const Sale = z.object({
  id: z.string().uuid(),
  billNo: z.string(),
  deviceId: z.string(),
  userId: z.string().uuid().nullable(),
  items: z.array(SaleItem).min(1),
  subtotal: z.number().int().nonnegative(),
  discount: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  method: PaymentMethod,
  received: z.number().int().nonnegative(),
  change: z.number().int().nonnegative(),
  status: z.enum(['completed', 'voided']),
  createdAt: z.string(),
  seq: z.number().int(),
});
export type Sale = z.infer<typeof Sale>;

export const ShopSettings = z.object({
  name: z.string().trim().min(1).max(80),
  address: z.string().trim().max(200).default(''),
  phone: z.string().trim().max(30).default(''),
  /** เบอร์มือถือ / เลขประจำตัว 13 หลัก ที่ผูกพร้อมเพย์ — ว่าง = ไม่แสดง QR */
  promptPayId: z.string().trim().max(20).default(''),
  seq: z.number().int(),
});
export type ShopSettings = z.infer<typeof ShopSettings>;

export const User = z.object({ id: z.string().uuid(), name: z.string(), username: z.string(), role: Role });
export type User = z.infer<typeof User>;
