/**
 * PromptPay QR (Thai QR Payment, มาตรฐาน EMVCo Merchant-Presented)
 * รองรับ: เบอร์มือถือ 10 หลัก, เลขบัตรประชาชน / เลขผู้เสียภาษี 13 หลัก, e-Wallet 15 หลัก
 */

const tlv = (id: string, value: string) => id + String(value.length).padStart(2, '0') + value;

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) ตามที่ EMVCo กำหนด */
export function crc16(s: string): string {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function normalizePromptPayId(raw: string): { tag: '01' | '02' | '03'; value: string } | null {
  const d = raw.replace(/\D/g, '');
  if (d.length === 10 && d.startsWith('0')) return { tag: '01', value: ('0066' + d.slice(1)).padStart(13, '0') };
  if (d.length === 13) return { tag: '02', value: d };
  if (d.length === 15) return { tag: '03', value: d };
  return null;
}

export const isValidPromptPayId = (raw: string) => normalizePromptPayId(raw) !== null;

/** @param amount สตางค์; ไม่ใส่ = QR แบบลูกค้ากรอกยอดเอง */
export function promptPayPayload(id: string, amount?: number): string {
  const target = normalizePromptPayId(id);
  if (!target) throw new Error('รหัสพร้อมเพย์ต้องเป็นเบอร์มือถือ 10 หลัก หรือเลขประจำตัว 13 หลัก');
  const body =
    tlv('00', '01') +
    tlv('01', amount ? '12' : '11') +
    tlv('29', tlv('00', 'A000000677010111') + tlv(target.tag, target.value)) +
    tlv('53', '764') +
    (amount ? tlv('54', (amount / 100).toFixed(2)) : '') +
    tlv('58', 'TH') +
    '6304';
  return body + crc16(body);
}
