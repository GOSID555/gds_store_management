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

describe('บังคับล็อกอิน + ตั้งบัญชีเจ้าของร้านครั้งแรก', () => {
  it('ครั้งแรกให้ตั้งบัญชี ตั้งได้ครั้งเดียว แล้วล็อกอินด้วยบัญชีนั้นได้', async () => {
    const app = await make(true);
    expect((await app.inject({ method: 'GET', url: '/api/auth/status' })).json()).toEqual({ requireLogin: true, needsSetup: true });

    const setup = await app.inject({ method: 'POST', url: '/api/auth/setup', payload: { username: 'boss', password: 'secret123' } });
    expect(setup.statusCode).toBe(200);
    expect(setup.json().user.role).toBe('owner');

    const again = await app.inject({ method: 'POST', url: '/api/auth/setup', payload: { username: 'hacker', password: 'secret123' } });
    expect(again.statusCode).toBe(409);
    expect((await app.inject({ method: 'GET', url: '/api/auth/status' })).json().needsSetup).toBe(false);
    expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'boss', password: 'secret123' } })).statusCode).toBe(200);
  });

  it('ไม่มี token ใช้ข้อมูลร้านไม่ได้', async () => {
    const app = await make(true);
    expect((await app.inject({ method: 'GET', url: '/api/sync/pull' })).statusCode).toBe(401);
  });

  it('token บัญชีกลางจากโหมดทดลองใช้ไม่ได้อีกเมื่อเปิดบังคับล็อกอิน', async () => {
    const d = await createDb('pglite:memory');
    dbs.push(d);
    const open = await buildApp({ db: d.db, jwtSecret: 'test-secret-test-secret', requireLogin: false });
    const { token } = (await open.inject({ method: 'POST', url: '/api/auth/guest' })).json();
    const locked = await buildApp({ db: d.db, jwtSecret: 'test-secret-test-secret', requireLogin: true });
    const r = await locked.inject({ method: 'GET', url: '/api/sync/pull', headers: { authorization: `Bearer ${token}` } });
    expect(r.statusCode).toBe(401);
  });
});

describe('จัดการสิทธิ์เข้าใช้', () => {
  async function shop() {
    const app = await make(true);
    const owner = (await app.inject({ method: 'POST', url: '/api/auth/setup', payload: { username: 'boss', password: 'secret123' } })).json().token;
    const auth = (t: string) => ({ authorization: `Bearer ${t}` });
    const staff = (await app.inject({ method: 'POST', url: '/api/users', headers: auth(owner), payload: { name: 'น้อง', username: 'nong', password: 'secret123' } })).json();
    const nong = (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'nong', password: 'secret123' } })).json().token;
    return { app, owner, staff, nong, auth };
  }

  it('ปิดบัญชีพนักงาน → token เดิมใช้ไม่ได้ทันที และล็อกอินใหม่ไม่ได้', async () => {
    const { app, owner, staff, nong, auth } = await shop();
    expect((await app.inject({ method: 'GET', url: '/api/sync/pull', headers: auth(nong) })).statusCode).toBe(200);
    await app.inject({ method: 'PATCH', url: `/api/users/${staff.id}`, headers: auth(owner), payload: { disabled: true } });
    expect((await app.inject({ method: 'GET', url: '/api/sync/pull', headers: auth(nong) })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'nong', password: 'secret123' } })).statusCode).toBe(401);
  });

  it('ตั้งรหัสใหม่ให้พนักงาน → รหัสเก่าและ token เก่าใช้ไม่ได้ รหัสใหม่ใช้ได้', async () => {
    const { app, owner, staff, nong, auth } = await shop();
    await app.inject({ method: 'PATCH', url: `/api/users/${staff.id}`, headers: auth(owner), payload: { password: 'newpass99' } });
    expect((await app.inject({ method: 'GET', url: '/api/sync/pull', headers: auth(nong) })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'nong', password: 'secret123' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'nong', password: 'newpass99' } })).statusCode).toBe(200);
  });

  it('เปลี่ยนรหัสของตัวเองต้องใส่รหัสเดิมถูก และได้ token ใหม่', async () => {
    const { app, nong, auth } = await shop();
    expect((await app.inject({ method: 'POST', url: '/api/auth/password', headers: auth(nong), payload: { current: 'wrong', next: 'abcdef12' } })).statusCode).toBe(401);
    const r = await app.inject({ method: 'POST', url: '/api/auth/password', headers: auth(nong), payload: { current: 'secret123', next: 'abcdef12' } });
    expect(r.statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/sync/pull', headers: auth(r.json().token) })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/sync/pull', headers: auth(nong) })).statusCode).toBe(401);
  });

  it('แคชเชียร์จัดการบัญชีคนอื่นไม่ได้', async () => {
    const { app, staff, nong, auth } = await shop();
    expect((await app.inject({ method: 'PATCH', url: `/api/users/${staff.id}`, headers: auth(nong), payload: { disabled: true } })).statusCode).toBe(403);
  });
});
