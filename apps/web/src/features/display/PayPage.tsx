import { useEffect, useState } from 'react';
import { DISPLAY_CODE, formatBaht, type DisplayState } from '@pos/shared';
import { QrCode } from '../../components/QrCode';
import { subscribeDisplay } from '../../lib/display';
import './display.css';

/**
 * หน้าสแกนจ่าย — /pay?code=XXXXXXXX
 * เปิดทิ้งไว้บนมือถือ/แท็บเล็ตที่ตั้งหน้าเคาน์เตอร์ แสดงแค่ QR พร้อมเพย์ตัวใหญ่ตามยอดบิลปัจจุบัน
 * QR สร้างใหม่ทุกครั้งที่ยอดเปลี่ยนหรือเริ่มบิลใหม่ (ข้อมูลมาจากเครื่องแคชเชียร์ที่ใช้รหัสเดียวกัน)
 */
export function PayPage() {
  const raw = new URLSearchParams(location.search).get('code')?.toUpperCase() ?? null;
  const code = raw && DISPLAY_CODE.test(raw) ? raw : null;
  const [s, setS] = useState<DisplayState | null>(null);
  const [online, setOnline] = useState(true);
  /** นับรอบบิล ใช้เป็น key ให้ QR ถูกวาดใหม่ (มีแอนิเมชัน) ทุกบิล */
  const [round, setRound] = useState(0);

  useEffect(
    () =>
      subscribeDisplay(
        code,
        (next) =>
          setS((prev) => {
            if (prev?.phase === 'done' || prev?.phase === 'idle' || !prev) if (next.phase === 'cart' || next.phase === 'pay') setRound((r) => r + 1);
            return next;
          }),
        setOnline,
      ),
    [code],
  );

  useEffect(() => {
    let lock: { release(): Promise<void> } | undefined;
    const req = () => (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<typeof lock> } }).wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {});
    void req();
    document.addEventListener('visibilitychange', req);
    return () => {
      document.removeEventListener('visibilitychange', req);
      void lock?.release();
    };
  }, []);

  const shop = s?.shopName || 'สแกนจ่าย';
  const count = s?.items.reduce((a, i) => a + i.qty, 0) ?? 0;

  let body;
  if (!code) {
    body = <Center title="ลิงก์ไม่ครบ" sub="เปิดลิงก์จากหน้า ตั้งค่า → จอลูกค้า ของเครื่องแคชเชียร์" />;
  } else if (!s || s.phase === 'idle') {
    body = <Center title="รอยอดชำระ" sub="QR จะขึ้นเองเมื่อพนักงานเริ่มคิดเงิน" />;
  } else if (s.phase === 'done') {
    body = (
      <div className="cd-center">
        <div className="cd-check" aria-hidden>✓</div>
        <div className="cd-hello">ชำระแล้ว</div>
        <p className="cd-sub">{formatBaht(s.total)}{s.billNo ? ` · บิล ${s.billNo}` : ''} · ขอบคุณค่ะ</p>
      </div>
    );
  } else if (s.method === 'cash') {
    body = <Center title={formatBaht(s.total)} sub="ชำระด้วยเงินสดที่พนักงาน" />;
  } else if (!s.qr) {
    body = <Center title={formatBaht(s.total)} sub="ร้านยังไม่ได้ตั้งพร้อมเพย์ โปรดชำระกับพนักงาน" />;
  } else {
    body = (
      <div className="pp-wrap">
        <div className="cd-label">ยอดที่ต้องชำระ{count ? ` · ${count} ชิ้น` : ''}</div>
        <div className="cd-total">{formatBaht(s.total)}</div>
        <div className="pp-qr" key={`${round}-${s.qr}`}>
          <QrCode value={s.qr} size={320} label={`QR พร้อมเพย์ ยอด ${formatBaht(s.total)}`} />
        </div>
        <div className="cd-pp">PromptPay</div>
        <p className="cd-sub">สแกนด้วยแอปธนาคารใดก็ได้ ยอดเงินกรอกให้แล้ว</p>
      </div>
    );
  }

  return (
    <div className="cd">
      <header className="cd-top">
        <span className="cd-shop">{shop}</span>
        {code && !online && <span className="cd-conn">กำลังเชื่อมต่อใหม่…</span>}
      </header>
      {body}
    </div>
  );
}

function Center({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="cd-center">
      <div className="cd-hello">{title}</div>
      <p className="cd-sub">{sub}</p>
    </div>
  );
}
