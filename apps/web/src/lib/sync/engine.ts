import { useSyncExternalStore } from 'react';
import { api, HttpError } from '../api';
import { db, getMeta, setMeta } from '../db';
import { session } from '../session';

/**
 * Sync engine
 *  1. PUSH outbox ทีละชุดตามลำดับ → ลบรายการที่ server รับแล้ว (applied / duplicate)
 *     รายการที่ถูกปฏิเสธถาวร (rejected) ย้ายไปเก็บใน syncErrors ให้เจ้าของร้านเห็น
 *  2. PULL ทุกอย่างที่ seq > cursor แล้วเขียนทับสำเนาในเครื่อง
 * เรียกเมื่อ: เปิดแอป, เน็ตกลับมา, กลับเข้าแท็บ, ทุก 15 วินาที, และหลังทุกการบันทึก
 */
export type SyncState = { status: 'idle' | 'syncing' | 'offline' | 'error'; lastSyncAt: string | null; error?: string };

let state: SyncState = { status: navigator.onLine ? 'idle' : 'offline', lastSyncAt: null };
const listeners = new Set<() => void>();
const setState = (patch: Partial<SyncState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
export const useSyncState = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
  );

let running: Promise<void> | null = null;
let again = false;

export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await runOnce();
    } while (again);
  })().finally(() => (running = null));
  return running;
}

async function runOnce() {
  if (!session.get()) return;
  if (!navigator.onLine) return setState({ status: 'offline' });
  setState({ status: 'syncing', error: undefined });
  try {
    await push();
    await pull();
    setState({ status: 'idle', lastSyncAt: new Date().toISOString() });
  } catch (e) {
    const offline = !(e instanceof HttpError);
    setState({ status: offline ? 'offline' : 'error', error: e instanceof Error ? e.message : String(e) });
  }
}

async function push() {
  for (;;) {
    const batch = await db.outbox.orderBy('id').limit(50).toArray();
    if (!batch.length) return;
    const { results } = await api.push({ mutations: batch.map((b) => b.mutation) });
    const byMid = new Map(results.map((r) => [r.mid, r]));

    await db.transaction('rw', db.outbox, db.sales, db.meta, async () => {
      const errors = (await getMeta('syncErrors')) ?? [];
      for (const item of batch) {
        const r = byMid.get(item.mutation.mid);
        if (!r) continue;
        if (r.status === 'rejected') {
          errors.unshift({ at: new Date().toISOString(), type: item.mutation.type, error: r.error });
          if (item.mutation.type === 'sale.create') await db.sales.update(item.mutation.payload.id, { rejected: r.error });
        }
        await db.outbox.delete(item.id!);
      }
      await setMeta({ key: 'syncErrors', value: errors.slice(0, 50) });
    });
  }
}

async function pull() {
  let cursor = (await getMeta('cursor')) ?? 0;
  for (;;) {
    const res = await api.pull(cursor);
    await db.transaction('rw', db.products, db.sales, db.meta, async () => {
      if (res.products.length) await db.products.bulkPut(res.products);
      if (res.sales.length) await db.sales.bulkPut(res.sales); // สำเนาจาก server ไม่มี flag pending
      if (res.settings) {
        const { seq: _seq, ...settings } = res.settings;
        await setMeta({ key: 'settings', value: settings });
      }
      await setMeta({ key: 'cursor', value: res.cursor });
    });
    cursor = res.cursor;
    if (!res.hasMore) return;
  }
}

let started = false;
export function startSync() {
  if (started) return;
  started = true;
  window.addEventListener('online', () => void syncNow());
  window.addEventListener('offline', () => setState({ status: 'offline' }));
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void syncNow());
  setInterval(() => void syncNow(), 15_000);
  session.subscribe(() => void syncNow());
  void syncNow();
}

/** ออกจากระบบ / เปลี่ยนร้าน: ล้างข้อมูลในเครื่อง (ต้องไม่มีรายการค้างส่ง) */
export async function resetLocalData() {
  await db.transaction('rw', db.products, db.sales, db.outbox, db.meta, async () => {
    await Promise.all([db.products.clear(), db.sales.clear(), db.outbox.clear(), db.meta.clear()]);
  });
}
