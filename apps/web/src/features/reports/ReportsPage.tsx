import { useMemo, useState } from 'react';
import { formatBaht } from '@pos/shared';
import type { LocalSale } from '../../lib/db';
import { useSalesSince } from '../../lib/hooks';
import { ReceiptDialog } from '../sell/ReceiptDialog';

const DAY = 864e5;
const dayStart = (offset = 0) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime() - offset * DAY;
};

/** รายงานคำนวณจากข้อมูลในเครื่อง → ดูได้แม้ออฟไลน์ */
export function ReportsPage() {
  const [range, setRange] = useState<1 | 7 | 30>(1);
  const [open, setOpen] = useState<LocalSale | null>(null);
  const windowStart = new Date(dayStart(29)).toISOString();
  const sales = useSalesSince(windowStart);

  const r = useMemo(() => {
    const all = sales ?? [];
    const live = all.filter((s) => s.status === 'completed' && !s.rejected);
    const start = dayStart(range - 1);
    const inRange = live.filter((s) => Date.parse(s.createdAt) >= start);
    const total = inRange.reduce((a, s) => a + s.total, 0);
    const cost = inRange.reduce((a, s) => a + s.items.reduce((b, i) => b + i.cost * i.qty, 0), 0);
    const days = Array.from({ length: 7 }, (_, k) => {
      const s = dayStart(6 - k);
      return { s, v: live.filter((x) => { const t = Date.parse(x.createdAt); return t >= s && t < s + DAY; }).reduce((a, x) => a + x.total, 0) };
    });
    const agg = new Map<string, { q: number; v: number }>();
    for (const s of inRange) for (const i of s.items) {
      const a = agg.get(i.name) ?? { q: 0, v: 0 };
      a.q += i.qty;
      a.v += i.price * i.qty;
      agg.set(i.name, a);
    }
    const top = [...agg].sort((a, b) => b[1].v - a[1].v).slice(0, 6);
    const bills = all.filter((s) => Date.parse(s.createdAt) >= start);
    return { total, cost, count: inRange.length, days, top, bills, start };
  }, [sales, range]);

  const max = Math.max(1, ...r.days.map((d) => d.v));
  const short = (t: number) => new Date(t).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

  return (
    <section className="view">
      <div className="scroll"><div className="wrap">
        <div className="sec-h">
          <div><h2>ยอดขาย</h2><p>{range === 1 ? 'วันนี้' : `${range} วันล่าสุด`} · {short(r.start)} ถึง {short(Date.now())}</p></div>
          <div className="seg">
            {([1, 7, 30] as const).map((n) => <button key={n} aria-pressed={range === n} onClick={() => setRange(n)}>{n === 1 ? 'วันนี้' : `${n} วัน`}</button>)}
          </div>
        </div>
        <div className="kpis">
          <div className="kpi"><div className="l">ยอดขาย</div><div className="v">{formatBaht(r.total)}</div></div>
          <div className="kpi"><div className="l">จำนวนบิล</div><div className="v">{r.count}</div></div>
          <div className="kpi"><div className="l">กำไรขั้นต้น</div><div className="v">{formatBaht(r.total - r.cost)}</div></div>
          <div className="kpi"><div className="l">เฉลี่ยต่อบิล</div><div className="v">{formatBaht(r.count ? Math.round(r.total / r.count) : 0)}</div></div>
        </div>
        <div className="cols">
          <div className="panel">
            <div className="panel-h"><h3>ยอดขาย 7 วันล่าสุด</h3></div>
            <div className="bars">
              {r.days.map((d, i) => (
                <div key={d.s} className={`bar ${i === 6 ? 'today' : ''}`}>
                  <span className="bv">{d.v ? Math.round(d.v / 100).toLocaleString('th-TH') : ''}</span>
                  <div className="b" style={{ height: `${(d.v / max) * 82}%` }} />
                </div>
              ))}
            </div>
            <div className="bar-x">{r.days.map((d, i) => <span key={d.s}>{i === 6 ? 'วันนี้' : new Date(d.s).toLocaleDateString('th-TH', { weekday: 'short' })}</span>)}</div>
          </div>
          <div className="panel">
            <div className="panel-h"><h3>ขายดี</h3></div>
            <ul className="top">
              {r.top.length ? r.top.map(([n, a]) => (
                <li key={n}>
                  <span>{n} <span style={{ color: 'var(--muted)' }}>× {a.q}</span></span>
                  <span className="num">{formatBaht(a.v)}</span>
                  <span className="track"><i style={{ width: `${(a.v / r.top[0]![1].v) * 100}%` }} /></span>
                </li>
              )) : <li className="empty" style={{ display: 'block' }}>ยังไม่มีการขายในช่วงนี้</li>}
            </ul>
          </div>
        </div>
        <div className="panel">
          <div className="panel-h"><h3>บิลขาย</h3><span className="note">แตะที่บิลเพื่อดูใบเสร็จ</span></div>
          <div className="tbl-wrap"><table>
            <thead><tr><th>เลขที่บิล</th><th>เวลา</th><th className="hide-sm">รายการ</th><th>สถานะ</th><th className="r">ยอด</th></tr></thead>
            <tbody>
              {!r.bills.length ? <tr><td colSpan={5}><div className="empty">ยังไม่มีบิลในช่วงนี้</div></td></tr> : r.bills.slice(0, 300).map((s) => (
                <tr key={s.id} className={`click ${s.status === 'voided' ? 'void' : ''}`} onClick={() => setOpen(s)}>
                  <td className="num">{s.billNo}</td>
                  <td>{new Date(s.createdAt).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="hide-sm">{s.items.reduce((a, i) => a + i.qty, 0)} ชิ้น</td>
                  <td>
                    {s.rejected ? <span className="pill out">ถูกปฏิเสธ</span>
                      : s.status === 'voided' ? <span className="pill out">ยกเลิก</span>
                      : s.pending ? <span className="pill pending">รอซิงก์</span>
                      : s.method === 'transfer' ? 'โอน' : 'เงินสด'}
                  </td>
                  <td className="r num">{formatBaht(s.total, false)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      </div></div>
      {open && <ReceiptDialog sale={open} canVoid onClose={() => setOpen(null)} />}
    </section>
  );
}
