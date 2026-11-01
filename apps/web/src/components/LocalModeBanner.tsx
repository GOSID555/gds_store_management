import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { session } from '../lib/session';
import { resetLocalData } from '../lib/sync/engine';

/**
 * อยู่โหมดเก็บในเครื่อง แต่ตอนนี้เซิร์ฟเวอร์ (ฐานข้อมูล) พร้อมแล้ว → ชวนสลับไปใช้แบบซิงก์ทุกเครื่อง
 * ข้อมูลในโหมดเก็บในเครื่องไม่ย้ายตามไป (เป็นข้อมูลทดลอง)
 */
export function LocalModeBanner() {
  const [guest, setGuest] = useState<Awaited<ReturnType<typeof api.guest>> | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = () => api.guest().then((g) => alive && setGuest(g)).catch(() => {});
    void check();
    const t = setInterval(check, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (!guest) return null;

  async function switchToSync() {
    await resetLocalData();
    session.set(guest);
  }

  return (
    <div className="banner" role="status">
      {confirming ? (
        <>
          สินค้าและบิลที่ทำไว้ในโหมดเก็บในเครื่องจะไม่ย้ายไปด้วย{' '}
          <button className="btn sm primary" onClick={() => void switchToSync()}>สลับเลย</button>{' '}
          <button className="btn sm ghost" onClick={() => setConfirming(false)}>ยังก่อน</button>
        </>
      ) : (
        <>
          เซิร์ฟเวอร์พร้อมแล้ว ใช้แบบซิงก์ข้อมูลทุกเครื่องได้{' '}
          <button className="btn sm primary" onClick={() => setConfirming(true)}>ใช้แบบซิงก์ทุกเครื่อง</button>
        </>
      )}
    </div>
  );
}
