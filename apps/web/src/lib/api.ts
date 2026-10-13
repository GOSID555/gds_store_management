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
  push: (body: PushRequest) => request<PushResponse>('/sync/push', { method: 'POST', body: JSON.stringify(body) }),
  pull: (since: number) => request<PullResponse>(`/sync/pull?since=${since}&limit=500`),
  listUsers: () => request<SessionUser[]>('/users'),
  createUser: (u: { name: string; username: string; password: string; role: 'owner' | 'cashier' }) =>
    request<SessionUser>('/users', { method: 'POST', body: JSON.stringify(u) }),
};
