/**
 * เงินทั้งระบบเก็บเป็น "สตางค์" (จำนวนเต็ม) เพื่อเลี่ยงปัญหาทศนิยมของ float
 * แปลงเป็นบาทเฉพาะตอนแสดงผลหรือรับค่าจากผู้ใช้เท่านั้น
 */
export type Satang = number;

export const toSatang = (baht: number | string): Satang => Math.round(Number(baht || 0) * 100);
export const toBaht = (s: Satang): number => s / 100;

const fmt = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatBaht = (s: Satang, withSymbol = true): string => (withSymbol ? '฿' : '') + fmt.format(s / 100);
