import { useState, type FormEvent } from 'react';
import type { Product } from '@pos/shared';
import { Modal } from '../../components/Modal';
import { actions } from '../../lib/mutations';

type Mode = 'receive' | 'waste' | 'count';

/**
 * "ตั้งยอดใหม่" (count) ส่งเป็น delta จากยอดที่เครื่องนี้เห็นตอนนับ
 * ถ้ามีเครื่องอื่นขายระหว่างนั้น ยอดขายนั้นยังถูกหักต่อ ไม่หายไป
 */
export function StockAdjustDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>('receive');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const n = parseInt(qty) || 0;
  const delta = mode === 'receive' ? n : mode === 'waste' ? -n : n - product.stock;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (delta) await actions.adjustStock(product.id, delta, mode === 'receive' ? 'receive' : mode === 'waste' ? 'waste' : 'adjust', note || undefined);
    onClose();
  }

  return (
    <Modal title={`ปรับสต็อก · ${product.name}`} onClose={onClose}>
      <form className="modal-b" onSubmit={submit}>
        <div className="row muted"><span>คงเหลือตอนนี้</span><span className="num">{product.stock}</span></div>
        <div className="seg" style={{ alignSelf: 'flex-start', flexWrap: 'wrap' }}>
          <button type="button" aria-pressed={mode === 'receive'} onClick={() => setMode('receive')}>รับของเข้า (+)</button>
          <button type="button" aria-pressed={mode === 'waste'} onClick={() => setMode('waste')}>เสีย/ตัดออก (−)</button>
          <button type="button" aria-pressed={mode === 'count'} onClick={() => setMode('count')}>นับจริงได้</button>
        </div>
        <label className="f">จำนวน<input id="adj-qty" type="number" step={1} min={0} inputMode="numeric" required autoFocus value={qty} onChange={(e) => setQty(e.target.value)} /></label>
        <label className="f">หมายเหตุ<input id="adj-note" placeholder="เช่น ล็อตจากซัพพลายเออร์ A" value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <div className="row muted"><span>หลังปรับ</span><span className="num">{product.stock + delta}</span></div>
        <div className="modal-f" style={{ padding: 0 }}>
          <button type="button" className="btn" onClick={onClose}>ยกเลิก</button>
          <button className="btn primary">บันทึก</button>
        </div>
      </form>
    </Modal>
  );
}
