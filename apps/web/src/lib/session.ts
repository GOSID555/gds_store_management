import { useSyncExternalStore } from 'react';
import type { Role } from '@pos/shared';

export type SessionUser = { id: string; name: string; username: string; role: Role };
/** local = ไม่ต่อเซิร์ฟเวอร์ เก็บทุกอย่างใน IndexedDB ของเบราว์เซอร์นี้ (ใช้ทดลอง/ร้านที่มีเครื่องเดียว) */
type Session = { token: string; user: SessionUser; local?: true } | null;

const KEY = 'pos.session';
const DEVICE_KEY = 'pos.deviceId';

function read(): Session {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}

let current = read();
const listeners = new Set<() => void>();

export const session = {
  get: () => current,
  set(next: Session) {
    current = next;
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export const useSession = () => useSyncExternalStore(session.subscribe, session.get);

/** รหัสประจำเครื่อง: ใช้แยกว่าบิลมาจากเครื่องไหน และขึ้นต้นเลขที่บิล */
export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}
export const deviceCode = () => getDeviceId().slice(0, 4).toUpperCase();

export const isLocalMode = () => session.get()?.local === true;

/** เข้าโหมดเก็บในเครื่อง: ไม่ต้องมีบัญชี ไม่ต้องมีเซิร์ฟเวอร์ */
export function startLocalSession() {
  session.set({ token: '', local: true, user: { id: 'local', name: 'เครื่องนี้', username: 'local', role: 'owner' } });
}
