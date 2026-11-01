import type { PullResponse, PushRequest, PushResponse } from '@pos/shared';
import { session, type SessionUser } from './session';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

export class HttpError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = session.get()?.token;
  const res = await fetch(BASE + path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
  if (res.status === 401 && token) session.set(null);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new HttpError(res.status, body.error ?? 'http_error');
  }
  return res.json();
}

export const api = {
  login: (username: string, password: string) =>
    request<{ token: string; user: SessionUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  status: () => request<{ requireLogin: boolean; needsSetup: boolean }>('/auth/status'),
  setup: (b: { name: string; username: string; password: string }) =>
    request<{ token: string; user: SessionUser }>('/auth/setup', { method: 'POST', body: JSON.stringify(b) }),
  changePassword: (current: string, next: string) =>
    request<{ token: string; user: SessionUser }>('/auth/password', { method: 'POST', body: JSON.stringify({ current, next }) }),
  /** โหมดทดลอง: ขอ token โดยไม่ต้องมีบัญชี (server ตอบ 404 ถ้าเปิดบังคับเข้าสู่ระบบ) */
  guest: () => request<{ token: string; user: SessionUser }>('/auth/guest', { method: 'POST', body: '{}' }),
  push: (body: PushRequest) => request<PushResponse>('/sync/push', { method: 'POST', body: JSON.stringify(body) }),
  pull: (since: number) => request<PullResponse>(`/sync/pull?since=${since}&limit=500`),
  listUsers: () => request<(SessionUser & { disabled: boolean })[]>('/users'),
  updateUser: (id: string, b: { password?: string; disabled?: boolean }) =>
    request<SessionUser & { disabled: boolean }>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  createUser: (u: { name: string; username: string; password: string; role: 'owner' | 'cashier' }) =>
    request<SessionUser>('/users', { method: 'POST', body: JSON.stringify(u) }),
};
