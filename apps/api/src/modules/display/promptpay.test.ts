import { describe, expect, it } from 'vitest';
import { crc16, normalizePromptPayId, promptPayPayload } from '@pos/shared';

describe('PromptPay QR', () => {
  it('CRC-16/CCITT-FALSE ตรงค่ามาตรฐาน', () => {
    expect(crc16('123456789')).toBe('29B1');
  });

  it('แปลงเบอร์มือถือเป็นรูปแบบ 0066', () => {
    expect(normalizePromptPayId('081-234-5678')).toEqual({ tag: '01', value: '0066812345678' });
    expect(normalizePromptPayId('1234567890123')).toEqual({ tag: '02', value: '1234567890123' });
    expect(normalizePromptPayId('12345')).toBeNull();
  });

  it('สร้าง payload แบบมียอดเงิน และ CRC ท้ายตรวจสอบได้', () => {
    const p = promptPayPayload('0812345678', 11000);
    expect(p).toContain('010212'); // QR แบบใช้ครั้งเดียว (มียอด)
    expect(p).toContain('29370016A000000677010111011300668123456785303764');
    expect(p).toContain('5406110.00');
    expect(p).toContain('5802TH');
    expect(p.slice(-4)).toBe(crc16(p.slice(0, -4)));
  });

  it('ไม่ใส่ยอด = QR ให้ลูกค้ากรอกเอง', () => {
    const p = promptPayPayload('0812345678');
    expect(p).toContain('010211');
    expect(p).not.toContain('5406');
  });
});
