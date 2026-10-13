import { useSyncExternalStore } from 'react';
import type { Role } from '@pos/shared';

export type SessionUser = { id: string; name: string; username: string; role: Role };
type Session = { token: string; user: SessionUser } | null;

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
