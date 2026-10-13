import { useEffect, useRef, useState } from 'react';
import { DISPLAY_CODE, formatBaht, type DisplayState } from '@pos/shared';
import { QrCode } from '../../components/QrCode';
import { subscribeDisplay } from '../../lib/display';
import './display.css';

/**
 * จอลูกค้า — เปิดบนแท็บเล็ต/จอที่สองที่หันหาลูกค้า ไม่ต้องเข้าสู่ระบบ
 * /display?code=XXXXXXXX  (รหัสจากหน้า ตั้งค่า → จอลูกค้า ของเครื่องแคชเชียร์)
 */
export function CustomerDisplayPage() {
  const raw = new URLSearchParams(location.search).get('code')?.toUpperCase() ?? null;
  const code = raw && DISPLAY_CODE.test(raw) ? raw : null;
  const [s, setS] = useState<DisplayState | null>(null);
  const [online, setOnline] = useState(true);
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight }); // scrollTo อาจคืน Promise ห้าม return ให้ React
  }, [s?.items.length]);

  useEffect(() => subscribeDisplay(code, setS, setOnline), [code]);
  useEffect(() => {
    // ขอไม่ให้จอดับระหว่างเปิดทิ้งไว้ (ถ้าเบราว์เซอร์รองรับ)
    let lock: { release(): Promise<void> } | undefined;
    const req = () => (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<typeof lock> } }).wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {});
    void req();
    document.addEventListener('visibilitychange', req);
    return () => {
      document.removeEventListener('visibilitychange', req);
      void lock?.release();
    };
  }, []);

  const shop = s?.shopName || 'ยินดีต้อนรับ';

  return (
    <div className="cd">
      <header className="cd-top">
        <span className="cd-shop">{shop}</span>
        {code && !online && <span className="cd-conn">กำลังเชื่อมต่อใหม่…</span>}
      </header>

      {!s || s.phase === 'idle' ? (
        <div className="cd-center">
          <div className="cd-hello">สวัสดีค่ะ</div>
          <p className="cd-sub">{code ? 'รายการสินค้าจะแสดงที่นี่ระหว่างคิดเงิน' : 'เปิดหน้านี้จากลิงก์ในหน้า ตั้งค่า → จอลูกค้า ของเครื่องแคชเชียร์'}</p>
        </div>
      ) : s.phase === 'done' ? (
        <div className="cd-center">
          <div className="cd-check" aria-hidden>✓</div>
          <div className="cd-hello">ขอบคุณค่ะ</div>
          {s.method === 'cash' && (s.change ?? 0) > 0 && <p className="cd-change">เงินทอน <b>{formatBaht(s.change!)}</b></p>}
          <p className="cd-sub">ชำระแล้ว {formatBaht(s.total)}{s.billNo ? ` · บิล ${s.billNo}` : ''}</p>
        </div>
      ) : (
        <div className={`cd-body ${s.phase === 'pay' ? 'paying' : ''}`}>
          <section className="cd-items" aria-label="รายการสินค้า">
            <ol ref={list}>
              {s.items.map((i, k) => (
                <li key={k}>
                  <span className="q">{i.qty}×</span>
                  <span className="n">{i.name}</span>
                  <span className="p">{formatBaht(i.price * i.qty, false)}</span>
                </li>
              ))}
            </ol>
            <div className="cd-sum">
              {s.discount > 0 && <div><span>ส่วนลด</span><span>−{formatBaht(s.discount, false)}</span></div>}
            </div>
          </section>

          <section className="cd-pay">
            <div className="cd-label">{s.phase === 'pay' ? 'ยอดที่ต้องชำระ' : 'ยอดรวม'}</div>
            <div className="cd-total">{formatBaht(s.total)}</div>
            {s.phase === 'pay' && s.method === 'transfer' && (
              s.qr ? (
                <div className="cd-qr">
                  <QrCode value={s.qr} size={260} label={`QR พร้อมเพย์ ยอด ${formatBaht(s.total)}`} />
                  <div className="cd-pp">PromptPay</div>
                  <p>สแกนด้วยแอปธนาคารใดก็ได้ ยอดเงินกรอกให้แล้ว</p>
                </div>
              ) : <p className="cd-sub">โอนเงินตามยอด แล้วแสดงสลิปให้พนักงาน</p>
            )}
            {s.phase === 'pay' && s.method === 'cash' && (
              <div className="cd-cash">
                <div><span>รับเงิน</span><b>{formatBaht(s.received ?? s.total)}</b></div>
                <div><span>เงินทอน</span><b>{formatBaht(Math.max(0, (s.received ?? s.total) - s.total))}</b></div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
