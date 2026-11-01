import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app';
import { createDb } from '../../db/client';

const dbs: { close: () => Promise<void> }[] = [];
afterAll(() => Promise.all(dbs.map((d) => d.close())));

async function make(requireLogin: boolean) {
  const d = await createDb('pglite:memory');
  dbs.push(d);
  return buildApp({ db: d.db, jwtSecret: 'test-secret-test-secret', requireLogin });
}

describe('โหมดทดลอง (ไม่ต้องเข้าสู่ระบบ)', () => {
  it('ได้ token สิทธิ์เจ้าของร้านทันที และใช้ซิงก์ได้', async () => {
    const app = await make(false);
    const r = await app.inject({ method: 'POST', url: '/api/auth/guest' });
    expect(r.statusCode).toBe(200);
    const { token, user } = r.json();
    expect(user.role).toBe('owner');
    const pull = await app.inject({ method: 'GET', url: '/api/sync/pull', headers: { authorization: `Bearer ${token}` } });
    expect(pull.statusCode).toBe(200);
    // เรียกซ้ำได้บัญชีเดิม ไม่สร้างใหม่
    expect((await app.inject({ method: 'POST', url: '/api/auth/guest' })).json().user.id).toBe(user.id);
  });

  it('บัญชีกลางเข้าด้วยรหัสผ่านไม่ได้', async () => {
    const app = await make(false);
    await app.inject({ method: 'POST', url: '/api/auth/guest' });
    const r = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: '__guest__', password: '!disabled' } });
    expect(r.statusCode).toBe(401);
  });

  it('เมื่อบังคับเข้าสู่ระบบ /auth/guest ปิด', async () => {
    const app = await make(true);
    expect((await app.inject({ method: 'POST', url: '/api/auth/guest' })).statusCode).toBe(404);
  });
});
