import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Mutation, PullResponse, PushResponse } from '@pos/shared';
import { buildApp } from '../../app';
import { ensureOwner } from '../../bootstrap';
import { createDb } from '../../db/client';

let app: FastifyInstance;
let close: () => Promise<void>;
let owner = '';
let cashier = '';

const m = (type: Mutation['type'], payload: unknown, deviceId = 'dev-a') =>
  ({ mid: randomUUID(), deviceId, at: new Date().toISOString(), type, payload }) as Mutation;

async function push(token: string, mutations: Mutation[]) {
  const r = await app.inject({ method: 'POST', url: '/api/sync/push', headers: { authorization: `Bearer ${token}` }, payload: { mutations } });
  return r.json() as PushResponse;
}
async function pull(token: string, since = 0) {
  const r = await app.inject({ method: 'GET', url: `/api/sync/pull?since=${since}`, headers: { authorization: `Bearer ${token}` } });
  return r.json() as PullResponse;
}
const login = async (username: string, password: string) =>
  (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password } })).json().token as string;

beforeAll(async () => {
  const d = await createDb('pglite:memory');
  close = d.close;
  await ensureOwner(d.db, 'owner', 'secret123');
  app = await buildApp({ db: d.db, jwtSecret: 'test-secret-test-secret' });
  owner = await login('owner', 'secret123');
  await app.inject({ method: 'POST', url: '/api/users', headers: { authorization: `Bearer ${owner}` }, payload: { name: 'แคชเชียร์', username: 'cashier1', password: 'secret123' } });
  cashier = await login('cashier1', 'secret123');
});
afterAll(async () => {
  await app.close();
  await close();
});

describe('sync', () => {
  const pid = randomUUID();

  it('สร้างสินค้าและรับของเข้า แล้ว pull ได้สต็อกถูกต้อง', async () => {
    const r = await push(owner, [
      m('product.upsert', { id: pid, name: 'กาแฟ', category: 'เครื่องดื่ม', sku: null, price: 5500, cost: 1800, lowStock: 5, image: null, archived: false }),
      m('stock.adjust', { productId: pid, delta: 10, reason: 'receive' }),
    ]);
    expect(r.results.map((x) => x.status)).toEqual(['applied', 'applied']);
    const p = await pull(owner);
    expect(p.products[0]).toMatchObject({ id: pid, stock: 10, price: 5500 });
  });

  it('ใส่รูปสินค้าแล้วซิงก์ไปเครื่องอื่นได้ และเอารูปออกได้', async () => {
    const image = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
    const base = { id: pid, name: 'กาแฟ', category: 'เครื่องดื่ม', sku: null, price: 5500, cost: 1800, lowStock: 5, archived: false };
    await push(owner, [m('product.upsert', { ...base, image })]);
    expect((await pull(cashier)).products.find((x) => x.id === pid)).toMatchObject({ image, stock: 10 });
    await push(owner, [m('product.upsert', { ...base, image: null })]);
    expect((await pull(cashier)).products.find((x) => x.id === pid)!.image).toBeNull();
  });

  it('สองเครื่องขายตอนออฟไลน์ ซิงก์ทีหลัง สต็อกถูกหักครบ และส่งซ้ำไม่หักซ้ำ', async () => {
    const sale = (deviceId: string) =>
      m('sale.create', { id: randomUUID(), billNo: `${deviceId}-1`, items: [{ productId: pid, name: 'กาแฟ', price: 5500, cost: 1800, qty: 3 }], discount: 0, method: 'cash', received: 20000, createdAt: new Date().toISOString() }, deviceId);
    const a = sale('dev-a');
    const b = sale('dev-b');
    expect((await push(cashier, [a])).results[0]!.status).toBe('applied');
    expect((await push(cashier, [b])).results[0]!.status).toBe('applied');
    expect((await push(cashier, [a])).results[0]!.status).toBe('duplicate');

    const p = await pull(owner);
    expect(p.products.find((x) => x.id === pid)!.stock).toBe(4);
    const s = p.sales.find((x) => x.billNo === 'dev-a-1')!;
    expect(s).toMatchObject({ total: 16500, change: 3500, status: 'completed' });
    expect(s.items).toHaveLength(1);
  });

  it('แคชเชียร์ยกเลิกบิลไม่ได้ เจ้าของยกเลิกแล้วคืนสต็อก', async () => {
    const { sales } = await pull(owner);
    const saleId = sales[0]!.id;
    expect((await push(cashier, [m('sale.void', { saleId })])).results[0]!.status).toBe('rejected');
    expect((await push(owner, [m('sale.void', { saleId })])).results[0]!.status).toBe('applied');
    const p = await pull(owner);
    expect(p.products.find((x) => x.id === pid)!.stock).toBe(7);
  });

  it('pull แบบ incremental คืนเฉพาะสิ่งที่เปลี่ยนหลัง cursor', async () => {
    const first = await pull(owner);
    const again = await pull(owner, first.cursor);
    expect(again).toMatchObject({ products: [], sales: [], hasMore: false, cursor: first.cursor });
  });

  it('ไม่มี token เข้าไม่ได้', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/sync/pull' });
    expect(r.statusCode).toBe(401);
  });
});

describe('display relay', () => {
  it('ต้องเข้าสู่ระบบจึงส่งสถานะได้ และตรวจรหัสจับคู่', async () => {
    const state = { phase: 'cart', shopName: 'ร้าน', items: [{ name: 'กาแฟ', qty: 1, price: 5500 }], subtotal: 5500, discount: 0, total: 5500 };
    expect((await app.inject({ method: 'PUT', url: '/api/display/ABC123', payload: state })).statusCode).toBe(401);
    const bad = await app.inject({ method: 'PUT', url: '/api/display/abc', headers: { authorization: `Bearer ${cashier}` }, payload: state });
    expect(bad.statusCode).toBe(400);
    const ok = await app.inject({ method: 'PUT', url: '/api/display/ABC123', headers: { authorization: `Bearer ${cashier}` }, payload: state });
    expect(ok.json()).toEqual({ ok: true, viewers: 0 });
  });
});
