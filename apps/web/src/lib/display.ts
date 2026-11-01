import type { DisplayState } from '@pos/shared';
import { session } from './session';

/**
 * ส่งสถานะบิลไปจอลูกค้า 2 ทาง
 *  1. BroadcastChannel: จอที่สองบนคอมเครื่องเดียวกัน (ทำงานแม้ออฟไลน์)
 *  2. API /display/:code: แท็บเล็ต/มือถืออีกเครื่องที่จับคู่ด้วยรหัส
 */
const CODE_KEY = 'pos.displayCode';
const CHANNEL = 'pos-display';
const BASE = import.meta.env.VITE_API_URL ?? '/api';

export function getDisplayCode(): string {
  let code = localStorage.getItem(CODE_KEY);
  if (!code) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ไม่มี 0/O/1/I ที่อ่านสับสน
    code = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => alphabet[b % alphabet.length]).join('');
    localStorage.setItem(CODE_KEY, code);
  }
  return code;
}
export const resetDisplayCode = () => localStorage.removeItem(CODE_KEY);
export const displayUrl = (code = getDisplayCode()) => `${location.origin}/display?code=${code}`;

const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null;
let last = '';
let timer: ReturnType<typeof setTimeout> | undefined;

export function publishDisplay(state: DisplayState) {
  const json = JSON.stringify(state);
  if (json === last) return;
  last = json;
  bc?.postMessage(state);
  clearTimeout(timer);
  timer = setTimeout(() => {
    const token = session.get()?.token;
    if (!token || !navigator.onLine) return;
    fetch(`${BASE}/display/${getDisplayCode()}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: json,
    }).catch(() => {}); // จอลูกค้าเป็นของเสริม ห้ามทำให้การขายสะดุด
  }, 120);
}

/** ฝั่งจอลูกค้า: ฟังทั้งสองทาง ใช้ค่าล่าสุดที่มาถึง */
export function subscribeDisplay(code: string | null, onState: (s: DisplayState) => void, onConn: (ok: boolean) => void) {
  const local = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null;
  if (local) local.onmessage = (e) => onState(e.data as DisplayState);

  // poll ทุก 1 วินาที (ทำงานได้บน serverless) ขอเฉพาะเมื่อ version ใหม่กว่าที่มี
  let stopped = false;
  let version = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const poll = async () => {
    try {
      const res = await fetch(`${BASE}/display/${code}?after=${version}`, { cache: 'no-store' });
      if (res.status === 200) {
        const body = (await res.json()) as { version: number; state: DisplayState };
        version = body.version;
        onState(body.state);
      }
      onConn(res.ok);
    } catch {
      onConn(false);
    }
    if (!stopped) timer = setTimeout(poll, document.visibilityState === 'visible' ? 1000 : 5000);
  };
  if (code) void poll();

  return () => {
    stopped = true;
    clearTimeout(timer);
    local?.close();
  };
}
