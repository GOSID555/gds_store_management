import { usePendingCount } from '../lib/hooks';
import { syncNow, useSyncState } from '../lib/sync/engine';

export function SyncBadge() {
  const s = useSyncState();
  const pending = usePendingCount();
  const label =
    s.status === 'local' ? 'เก็บในเครื่องนี้'
    : s.status === 'offline' ? `ออฟไลน์${pending ? ` · ค้างส่ง ${pending}` : ''}`
    : s.status === 'syncing' ? 'กำลังซิงก์…'
    : s.status === 'error' ? 'ซิงก์ไม่สำเร็จ'
    : pending ? `ค้างส่ง ${pending}` : 'ซิงก์แล้ว';
  const cls = s.status === 'local' ? 'local' : s.status === 'idle' && !pending ? 'cloud' : s.status === 'error' ? 'error' : s.status === 'syncing' ? 'syncing' : 'local';
  return (
    <button className={`sync ${cls}`} onClick={() => void syncNow()} title={s.lastSyncAt ? `ซิงก์ล่าสุด ${new Date(s.lastSyncAt).toLocaleTimeString('th-TH')}` : 'แตะเพื่อซิงก์'} style={{ border: 0, background: 'none' }}>
      <i /> <span>{label}</span>
    </button>
  );
}
