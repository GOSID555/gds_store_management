import { formatBaht } from '@pos/shared';
import type { LocalSale } from '../lib/db';
import { useSettings } from '../lib/hooks';

const m = (s: number) => formatBaht(s, false);

export function Receipt({ sale }: { sale: LocalSale }) {
  const shop = useSettings();
  return (
    <div className="receipt">
      <div className="shop">{shop?.name}</div>
      {shop?.address && <div className="c" style={{ fontFamily: 'var(--f-body)', fontSize: 12 }}>{shop.address}</div>}
      {shop?.phone && <div className="c">โทร {shop.phone}</div>}
      <hr />
      <div className="rr"><span>บิล</span><span>{sale.billNo}</span></div>
      <div className="rr"><span>วันที่</span><span>{new Date(sale.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</span></div>
      <hr />
      {sale.items.map((i) => (
        <div key={i.productId}>
          <div className="rr"><span>{i.name}</span><span>{m(i.price * i.qty)}</span></div>
          <div style={{ color: '#666', fontSize: 12, margin: '-2px 0 2px' }}>&nbsp;{i.qty} × {m(i.price)}</div>
        </div>
      ))}
      <hr />
      <div className="rr"><span>รวม</span><span>{m(sale.subtotal)}</span></div>
      {sale.discount > 0 && <div className="rr"><span>ส่วนลด</span><span>-{m(sale.discount)}</span></div>}
      <div className="rr big"><span>ยอดสุทธิ</span><span>{m(sale.total)}</span></div>
      <div className="rr"><span>{sale.method === 'transfer' ? 'โอน' : 'รับเงินสด'}</span><span>{m(sale.received)}</span></div>
      {sale.method === 'cash' && <div className="rr"><span>เงินทอน</span><span>{m(sale.change)}</span></div>}
      <hr />
      {sale.status === 'voided'
        ? <div className="c big" style={{ color: '#B3261E' }}>*** ยกเลิกบิลแล้ว ***</div>
        : <div className="c" style={{ fontFamily: 'var(--f-body)' }}>ขอบคุณที่อุดหนุน</div>}
    </div>
  );
}
