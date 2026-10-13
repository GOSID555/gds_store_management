import { useEffect, useState } from 'react';
import { formatBaht, toSatang, type PaymentMethod } from '@pos/shared';
import { Modal } from '../../components/Modal';
import { QrCode } from '../../components/QrCode';
import type { LocalSale } from '../../lib/db';
import { actions } from '../../lib/mutations';
import type { PayDraft } from './SellPage';
import type { Cart } from './useCart';

const NOTES = [2000, 5000, 10000, 20000, 50000, 100000, 200000]; // สตางค์: 20, 50, 100, 200, 500, 1000, 2000 บาท

type Props = {
  cart: Cart;
  qr?: string;
  hasPromptPay: boolean;
  onChange: (d: PayDraft) => void;
  onClose: () => void;
  onDone: (s: LocalSale) => void;
};

export function PaymentDialog({ cart, qr, hasPromptPay, onChange, onClose, onDone }: Props) {
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const received = input === '' ? cart.total : toSatang(input);
  const diff = received - cart.total;
  const canPay = method === 'transfer' || diff >= 0;

  useEffect(() => onChange({ method, received: method === 'cash' ? received : cart.total }), [method, received, cart.total]);

  async function confirm() {
    if (!canPay || busy) return;
    setBusy(true);
    // บันทึกลงเครื่องก่อนเสมอ → สำเร็จทันทีแม้ออฟไลน์ แล้ว sync engine ส่งขึ้น server ตามหลัง
    const sale = await actions.createSale(cart.items.map(({ product: _p, ...i }) => i), cart.discount, method, method === 'cash' ? received : cart.total);
    onDone(sale);
  }

  return (
    <Modal title="รับเงิน" onClose={onClose}>
      <div className="modal-b">
        <div className="due"><div className="l">ยอดที่ต้องชำระ</div><div className="v">{formatBaht(cart.total)}</div></div>
        <div className="seg" style={{ alignSelf: 'center' }}>
          <button aria-pressed={method === 'cash'} onClick={() => setMethod('cash')}>เงินสด</button>
          <button aria-pressed={method === 'transfer'} onClick={() => setMethod('transfer')}>โอน / พร้อมเพย์</button>
        </div>
        {method === 'cash' ? (
          <>
            <label className="f">รับเงินมา (บาท)
              <input id="recv" type="number" step="0.01" min={0} inputMode="decimal" autoFocus value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void confirm()} />
            </label>
            <div className="cash">
              <button onClick={() => setInput('')}>พอดี</button>
              {NOTES.filter((n) => n > cart.total).slice(0, 3).map((n) => (
                <button key={n} onClick={() => setInput(String(n / 100))}>{formatBaht(n).replace('.00', '')}</button>
              ))}
            </div>
            <div className={`change ${diff < 0 ? 'short' : ''}`}>
              <span>{diff < 0 ? 'ยังขาดอีก' : 'เงินทอน'}</span>
              <span className="v">{formatBaht(Math.abs(diff))}</span>
            </div>
          </>
        ) : qr ? (
          <div className="pay-qr">
            <QrCode value={qr} size={200} label={`QR พร้อมเพย์ ยอด ${formatBaht(cart.total)}`} />
            <p className="note">QR นี้แสดงบนจอลูกค้าด้วย ตรวจว่าเงินเข้าในแอปธนาคารของร้านก่อนกดยืนยัน</p>
          </div>
        ) : (
          <p className="note">{hasPromptPay ? 'รหัสพร้อมเพย์ในหน้าตั้งค่าไม่ถูกต้อง' : 'ยังไม่ได้ตั้งรหัสพร้อมเพย์ ไปที่ ตั้งค่า → ข้อมูลร้าน เพื่อให้ระบบสร้าง QR ตามยอดให้อัตโนมัติ'}</p>
        )}
      </div>
      <div className="modal-f">
        <button className="btn" onClick={onClose}>ยกเลิก</button>
        <button className="btn primary" style={{ padding: '11px 22px' }} disabled={!canPay || busy} onClick={() => void confirm()}>
          {method === 'transfer' ? 'ได้รับเงินแล้ว' : 'ยืนยันการขาย'}
        </button>
      </div>
    </Modal>
  );
}
