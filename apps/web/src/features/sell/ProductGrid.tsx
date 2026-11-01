import { useMemo, useState, type KeyboardEvent } from 'react';
import { formatBaht, type Product } from '@pos/shared';
import { stockState } from '../../lib/hooks';

/** สีประจำหมวดแบบท็อปปิ้งชานม: เผือก มัทฉะ สตรอว์เบอร์รี มะม่วง บลูเบอร์รี บราวน์ชูการ์ */
const TOPPINGS = ['var(--taro)', 'var(--matcha)', 'var(--strawberry)', 'var(--mango)', 'var(--blueberry)', 'var(--accent)'];
const colorOf = (s: string) => TOPPINGS[[...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0) % TOPPINGS.length];
const ALL = 'ทั้งหมด';

type Props = { products?: Product[]; qtyOf: (id: string) => number; onAdd: (p: Product) => void; onNotFound: (q: string) => void };

export function ProductGrid({ products, qtyOf, onAdd, onNotFound }: Props) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(ALL);
  const cats = useMemo(() => [ALL, ...new Set((products ?? []).map((p) => p.category))], [products]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (products ?? [])
      .filter((p) => (cat === ALL || p.category === cat) && (!term || p.name.toLowerCase().includes(term) || p.sku?.includes(term)))
      .sort((a, b) => Number(a.stock <= 0) - Number(b.stock <= 0));
  }, [products, q, cat]);

  /** รองรับเครื่องสแกนบาร์โค้ด (พิมพ์รหัสแล้วกด Enter) */
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const v = q.trim();
    if (!v) return;
    const exact = products?.find((p) => p.sku === v);
    const hits = exact ? [exact] : list.filter((p) => p.stock > 0);
    if (hits.length === 1) {
      onAdd(hits[0]!);
      setQ('');
    } else if (!hits.length) onNotFound(v);
  }

  return (
    <div className="catalog">
      <div className="searchbar">
        <div className="field">
          <input id="q" type="search" placeholder="ค้นหาชื่อสินค้า หรือสแกนบาร์โค้ด" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} />
          <kbd>Enter</kbd>
        </div>
      </div>
      <div className="chips">
        {cats.map((c) => (
          <button key={c} className="chip" aria-pressed={c === cat} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>
      <div className="grid">
        {!products ? (
          <div className="empty" style={{ gridColumn: '1/-1' }}>กำลังโหลดสินค้า…</div>
        ) : !products.length ? (
          <div className="empty" style={{ gridColumn: '1/-1' }}><b>ยังไม่มีสินค้า</b>ไปที่แท็บ “สต็อก” แล้วกด “เพิ่มสินค้า” หรือ “ใส่เมนูตัวอย่าง” เพื่อเริ่มขาย</div>
        ) : !list.length ? (
          <div className="empty" style={{ gridColumn: '1/-1' }}>ไม่พบสินค้าที่ตรงกับ “{q}”</div>
        ) : (
          list.map((p) => {
            const st = stockState(p);
            const qty = qtyOf(p.id);
            return (
              <button key={p.id} className="tile" disabled={st === 'out'} onClick={() => onAdd(p)}>
                {qty > 0 && <span className="qbadge">{qty}</span>}
                {p.image ? (
                  <img className="ph" src={p.image} alt="" loading="lazy" />
                ) : (
                  <span className="sw" style={{ background: colorOf(p.category) }}>{p.name.charAt(0)}</span>
                )}
                <span className="nm">{p.name}</span>
                <span className="ft">
                  <span className="pr">{formatBaht(p.price)}</span>
                  <span className={`st ${st}`}>{st === 'out' ? 'หมด' : `เหลือ ${p.stock}`}</span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
