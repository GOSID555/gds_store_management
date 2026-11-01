import { sql } from 'drizzle-orm';
import { bigint, boolean, index, integer, jsonb, pgSequence, pgTable, serial, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * ทุกแถวที่ client ต้องซิงก์มีคอลัมน์ `seq` ซึ่งดึงจาก sequence เดียวกันทุกครั้งที่แถวเปลี่ยน
 * client จำ seq ล่าสุดที่เห็นไว้ แล้วขอเฉพาะแถวที่ seq มากกว่านั้น (incremental pull)
 */
export const changeSeq = pgSequence('change_seq');
export const nextSeq = sql`nextval('change_seq')`;

const seqCol = () => bigint('seq', { mode: 'number' }).notNull();
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' });

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['owner', 'cashier'] }).notNull(),
  /** ปิดบัญชี (พนักงานลาออก) — token ที่มีอยู่ใช้ไม่ได้ทันที */
  disabled: boolean('disabled').notNull().default(false),
  /** เพิ่มทุกครั้งที่เปลี่ยนรหัส/ปิดบัญชี — token ที่ออกก่อนหน้าใช้ไม่ได้ (ล็อกเอาต์ทุกเครื่อง) */
  tokenVersion: integer('token_version').notNull().default(0),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
    category: text('category').notNull().default('อื่นๆ'),
    sku: text('sku'),
    price: integer('price').notNull(), // สตางค์
    cost: integer('cost').notNull().default(0),
    lowStock: integer('low_stock').notNull().default(5),
    image: text('image'),
    /** แคชของ SUM(stock_movements.delta) — อัปเดตใน transaction เดียวกับ movement เสมอ */
    stock: integer('stock').notNull().default(0),
    archived: boolean('archived').notNull().default(false),
    updatedAt: ts('updated_at').notNull().defaultNow(),
    seq: seqCol(),
  },
  (t) => ({ seqIdx: index('products_seq_idx').on(t.seq), skuIdx: index('products_sku_idx').on(t.sku) }),
);

/** Stock ledger: ทุกการเปลี่ยนแปลงสต็อกเป็น append-only ตรวจย้อนหลังได้ */
export const stockMovements = pgTable(
  'stock_movements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id').notNull().references(() => products.id),
    delta: integer('delta').notNull(),
    reason: text('reason', { enum: ['sale', 'void', 'receive', 'adjust', 'waste'] }).notNull(),
    refId: uuid('ref_id'),
    note: text('note'),
    userId: uuid('user_id').references(() => users.id),
    deviceId: text('device_id'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => ({ productIdx: index('stock_movements_product_idx').on(t.productId) }),
);

export const sales = pgTable(
  'sales',
  {
    id: uuid('id').primaryKey(),
    billNo: text('bill_no').notNull(),
    deviceId: text('device_id').notNull(),
    userId: uuid('user_id').references(() => users.id),
    subtotal: integer('subtotal').notNull(),
    discount: integer('discount').notNull().default(0),
    total: integer('total').notNull(),
    method: text('method', { enum: ['cash', 'transfer'] }).notNull(),
    received: integer('received').notNull(),
    change: integer('change').notNull(),
    status: text('status', { enum: ['completed', 'voided'] }).notNull().default('completed'),
    /** เวลาที่ขายจริงบนเครื่อง (อาจเก่ากว่าเวลาซิงก์ถ้าขายตอนออฟไลน์) */
    createdAt: ts('created_at').notNull(),
    syncedAt: ts('synced_at').notNull().defaultNow(),
    voidedAt: ts('voided_at'),
    seq: seqCol(),
  },
  (t) => ({ seqIdx: index('sales_seq_idx').on(t.seq), createdIdx: index('sales_created_idx').on(t.createdAt) }),
);

export const saleItems = pgTable(
  'sale_items',
  {
    id: serial('id').primaryKey(),
    saleId: uuid('sale_id').notNull().references(() => sales.id),
    productId: uuid('product_id').notNull().references(() => products.id),
    name: text('name').notNull(),
    price: integer('price').notNull(),
    cost: integer('cost').notNull(),
    qty: integer('qty').notNull(),
  },
  (t) => ({ saleIdx: index('sale_items_sale_idx').on(t.saleId) }),
);

export const shopSettings = pgTable('shop_settings', {
  id: integer('id').primaryKey().default(1),
  name: text('name').notNull(),
  address: text('address').notNull().default(''),
  phone: text('phone').notNull().default(''),
  promptPayId: text('promptpay_id').notNull().default(''),
  seq: seqCol(),
});

/** กันการประมวลผล mutation ซ้ำ (client retry ได้ปลอดภัย) */
export const processedMutations = pgTable('processed_mutations', {
  mid: uuid('mid').primaryKey(),
  type: text('type').notNull(),
  userId: uuid('user_id'),
  deviceId: text('device_id').notNull(),
  status: text('status', { enum: ['applied', 'rejected'] }).notNull(),
  error: text('error'),
  processedAt: ts('processed_at').notNull().default(sql`now()`),
});

/**
 * สถานะจอลูกค้าล่าสุดต่อรหัสจับคู่ — เก็บใน DB เพราะ serverless ไม่มีหน่วยความจำร่วมระหว่าง instance
 * แถวเดียวต่อจอ เขียนทับทุกครั้ง (ไม่ใช่ข้อมูลบัญชี)
 */
export const displayStates = pgTable('display_states', {
  code: text('code').primaryKey(),
  state: jsonb('state').notNull(),
  version: bigint('version', { mode: 'number' }).notNull().default(1),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});
