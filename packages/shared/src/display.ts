import { z } from 'zod';

/**
 * สถานะที่จอลูกค้าแสดง — จอแคชเชียร์ส่ง "ภาพทั้งหมด" ทุกครั้ง (ไม่ส่งส่วนต่าง)
 * จอลูกค้าที่เพิ่งเปิดหรือหลุดแล้วต่อใหม่จึงแสดงถูกทันที
 */
export const DisplayState = z.object({
  phase: z.enum(['idle', 'cart', 'pay', 'done']),
  shopName: z.string().max(80),
  items: z.array(z.object({ name: z.string().max(120), qty: z.number().int(), price: z.number().int() })).max(200).default([]),
  subtotal: z.number().int().default(0),
  discount: z.number().int().default(0),
  total: z.number().int().default(0),
  method: z.enum(['cash', 'transfer']).optional(),
  received: z.number().int().optional(),
  change: z.number().int().optional(),
  /** payload ของ QR พร้อมเพย์ (มีเมื่อจ่ายด้วยการโอน และร้านตั้งรหัสพร้อมเพย์แล้ว) */
  qr: z.string().max(512).optional(),
  billNo: z.string().max(40).optional(),
});
export type DisplayState = z.infer<typeof DisplayState>;

/** รหัสจับคู่จอ: ตัวอักษร/ตัวเลขพิมพ์ใหญ่ 6–12 ตัว */
export const DISPLAY_CODE = /^[A-Z0-9]{6,12}$/;
