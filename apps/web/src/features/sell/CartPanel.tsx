import { formatBaht, toBaht, toSatang, type Product } from '@pos/shared';
import type { Cart } from './useCart';

type Props = { cart: Cart; open: boolean; onClose: () => void; onAdd: (p: Product, d: number) => void; onPay: () => void };

export function CartPanel({ cart, open, onClose, onAdd, onPay }: Props) {
  return (
    <aside className={`cart ${open ? 'open' : ''}`}>
      <div className="cart-h">
        <h2>บิลปัจจุบัน</h2>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="linkbtn" onClick={cart.clear}>ล้างบิล</button>
          {open && <button className="linkbtn" onClick={onClose}>ปิด</button>}
        </div>
      </div>
      <div className="lines">
        {cart.items.length ? (
          cart.items.map((i) => (
            <div className="line" key={i.productId}>
              <div className="nm">{i.name}<div className="unit num">{formatBaht(i.price)} × {i.qty}</div></div>
              <div className="sub">{formatBaht(i.price * i.qty)}</div>
              <div />
              <div className="qty">
                <button aria-label="ลด" onClick={() => onAdd(i.product, -1)}>−</button>
                <span>{i.qty}</span>
                <button aria-label="เพิ่ม" onClick={() => onAdd(i.product, 1)}>+</button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty"><b>บิลว่าง</b>แตะสินค้า หรือสแกนบาร์โค้ดเพื่อเพิ่มลงบิล</div>
        )}
      </div>
      <div className="totals">
        <div className="row muted"><span>รวม {cart.count} ชิ้น</span><span className="num">{formatBaht(cart.subtotal)}</span></div>
        <div className="row muted">
          <label htmlFor="disc">ส่วนลด (บาท)</label>
          <input id="disc" className="disc" type="number" min={0} step={1} inputMode="decimal" value={cart.discount ? toBaht(cart.discount) : ''} onChange={(e) => cart.setDiscount(toSatang(e.target.value))} />
        </div>
        <div className="row grand"><span>ยอดชำระ</span><span className="num">{formatBaht(cart.total)}</span></div>
      </div>
      <button className="pay" disabled={!cart.items.length} onClick={onPay}>
        <span>รับเงิน</span><span className="num">{formatBaht(cart.total)}</span>
      </button>
    </aside>
  );
}
