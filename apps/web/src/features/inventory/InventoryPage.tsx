import { useMemo, useState } from 'react';
import { formatBaht, type Product } from '@pos/shared';
import { stockState, useProducts } from '../../lib/hooks';
import { actions } from '../../lib/mutations';
import { ProductFormDialog } from './ProductFormDialog';
import { StockAdjustDialog } from './StockAdjustDialog';

export function InventoryPage({ canEdit }: { canEdit: boolean }) {
  const products = useProducts();
  const [q, setQ] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [sampleMsg, setSampleMsg] = useState('');

  async function loadSamples() {
    setSampleMsg('กำลังใส่เมนู…');
    const n = await actions.loadSampleMenu();
    setSampleMsg(n ? `ใส่เมนูตัวอย่างแล้ว ${n} รายการ` : 'มีเมนูตัวอย่างครบอยู่แล้ว');
  }

  const ps = products ?? [];
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return ps.filter((p) => (!t || p.name.toLowerCase().includes(t) || p.sku?.includes(t)) && (!onlyLow || stockState(p) !== 'ok'));
  }, [ps, q, onlyLow]);
  const low = ps.filter((p) => stockState(p) !== 'ok').length;

  return (
    <section className="view">
      <div className="scroll"><div className="wrap">
        <div className="sec-h">
          <div><h2>สินค้าและสต็อก</h2><p>เพิ่มสินค้า รับของเข้า และดูรายการที่ใกล้หมด</p></div>
          {canEdit && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {sampleMsg && <span className="note">{sampleMsg}</span>}
              <button className="btn ghost" onClick={() => void loadSamples()}>ใส่เมนูตัวอย่าง (ชานม 20 รายการ)</button>
              <button className="btn primary" onClick={() => setEditing('new')}>+ เพิ่มสินค้า</button>
            </div>
          )}
        </div>
        <div className="kpis">
          <div className="kpi"><div className="l">รายการสินค้า</div><div className="v">{ps.length}</div></div>
          <div className="kpi"><div className="l">ชิ้นในสต็อก</div><div className="v">{ps.reduce((a, p) => a + Math.max(0, p.stock), 0).toLocaleString('th-TH')}</div></div>
          <div className="kpi"><div className="l">มูลค่าสต็อก (ทุน)</div><div className="v">{formatBaht(ps.reduce((a, p) => a + p.cost * Math.max(0, p.stock), 0))}</div></div>
          <div className="kpi"><div className="l">ใกล้หมด / หมด</div><div className={`v ${low ? 'warn' : ''}`}>{low}</div></div>
        </div>
        <div className="panel">
          <div className="panel-h">
            <div className="field" style={{ maxWidth: 340 }}><input id="sq" type="search" placeholder="ค้นหาสินค้า / บาร์โค้ด" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <div className="seg">
              <button aria-pressed={!onlyLow} onClick={() => setOnlyLow(false)}>ทั้งหมด</button>
              <button aria-pressed={onlyLow} onClick={() => setOnlyLow(true)}>ใกล้หมด</button>
            </div>
          </div>
          <div className="tbl-wrap"><table>
            <thead><tr><th>สินค้า</th><th className="hide-sm">หมวด</th><th className="r">ราคาขาย</th><th className="r hide-sm">ต้นทุน</th><th className="r">คงเหลือ</th><th /></tr></thead>
            <tbody>
              {!list.length ? (
                <tr><td colSpan={6}><div className="empty">{ps.length ? 'ไม่มีสินค้าตรงเงื่อนไข' : <><b>ยังไม่มีสินค้า</b>กด “เพิ่มสินค้า” เพื่อบันทึกรายการแรก</>}</div></td></tr>
              ) : list.map((p) => {
                const st = stockState(p);
                return (
                  <tr key={p.id}>
                    <td><div className="prod">
                      <div className="thumb">{p.image ? <img src={p.image} alt="" loading="lazy" /> : <span>{p.name.charAt(0)}</span>}</div>
                      <div><div className="nm">{p.name}</div>{p.sku && <div className="sku">{p.sku}</div>}</div>
                    </div></td>
                    <td className="hide-sm">{p.category}</td>
                    <td className="r num">{formatBaht(p.price, false)}</td>
                    <td className="r num hide-sm">{formatBaht(p.cost, false)}</td>
                    <td className="r"><span className={`pill ${st}`}><span className="num">{p.stock}</span>{st === 'out' ? ' หมด' : st === 'low' ? ' ใกล้หมด' : ''}</span></td>
                    <td><div className="acts">
                      <button className="btn sm" onClick={() => setAdjusting(p)}>ปรับสต็อก</button>
                      {canEdit && <button className="btn sm ghost" onClick={() => setEditing(p)}>แก้ไข</button>}
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </div>
      </div></div>
      {editing && <ProductFormDialog product={editing === 'new' ? null : editing} categories={[...new Set(ps.map((p) => p.category))]} onClose={() => setEditing(null)} />}
      {adjusting && <StockAdjustDialog product={adjusting} onClose={() => setAdjusting(null)} />}
    </section>
  );
}
