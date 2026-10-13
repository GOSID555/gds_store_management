import { useState } from 'react';
import { formatBaht } from '@pos/shared';
import { Modal } from '../../components/Modal';
import { Receipt } from '../../components/Receipt';
import type { LocalSale } from '../../lib/db';
import { actions } from '../../lib/mutations';

type Props = { sale: LocalSale; fresh?: boolean; canVoid?: boolean; onClose: () => void };

export function ReceiptDialog({ sale, fresh, canVoid, onClose }: Props) {
  const [confirmVoid, setConfirmVoid] = useState(false);

  if (confirmVoid)
    return (
      <Modal title={`ยกเลิกบิล ${sale.billNo}?`} onClose={() => setConfirmVoid(false)}>
        <div className="modal-b">
          <p className="note">ยอด {formatBaht(sale.total)} จะไม่นับในรายงาน และสินค้า {sale.items.reduce((a, i) => a + i.qty, 0)} ชิ้นจะถูกคืนเข้าสต็อก</p>
        </div>
        <div className="modal-f">
          <button className="btn" onClick={() => setConfirmVoid(false)}>ไม่ยกเลิก</button>
          <button className="btn danger" onClick={async () => { await actions.voidSale(sale.id); onClose(); }}>ยกเลิกบิล</button>
        </div>
      </Modal>
    );

  return (
    <Modal title={fresh ? 'ขายสำเร็จ' : 'ใบเสร็จ'} onClose={onClose}>
      <div className="modal-b" style={{ background: 'var(--surface-2)', paddingBlock: 20 }}>
        {fresh && sale.method === 'cash' && (
          <div className="change" style={{ background: 'var(--surface)' }}><span>ทอนลูกค้า</span><span className="v">{formatBaht(sale.change)}</span></div>
        )}
        {sale.rejected && <p className="err">เซิร์ฟเวอร์ไม่รับบิลนี้: {sale.rejected}</p>}
        <Receipt sale={sale} />
      </div>
      <div className="modal-f" style={{ paddingTop: 14 }}>
        {canVoid && sale.status === 'completed' && !sale.rejected && (
          <button className="btn ghost" style={{ marginRight: 'auto', color: 'var(--danger)' }} onClick={() => setConfirmVoid(true)}>ยกเลิกบิล</button>
        )}
        <button className="btn primary" autoFocus={fresh} onClick={onClose}>{fresh ? 'ขายบิลต่อไป' : 'ปิด'}</button>
      </div>
    </Modal>
  );
}
