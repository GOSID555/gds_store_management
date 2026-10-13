import type { FastifyPluginAsync } from 'fastify';
import { DISPLAY_CODE, DisplayState } from '@pos/shared';

/**
 * ส่งต่อสถานะบิลจากเครื่องแคชเชียร์ไปยังจอลูกค้าแบบเรียลไทม์ (Server-Sent Events)
 *
 * - เก็บในหน่วยความจำ ไม่ลงฐานข้อมูล: เป็นข้อมูลชั่วคราว บิลจริงไปทาง /sync เสมอ
 * - จอลูกค้าไม่ต้องเข้าสู่ระบบ อ่านได้ด้วยรหัสจับคู่ (สุ่ม, เดายาก) และเห็นแค่ตะกร้าปัจจุบัน
 * - ถ้ารัน API หลาย instance ต้องเปลี่ยนเป็น Redis pub/sub หรือ Postgres LISTEN/NOTIFY
 */
type Channel = { state: DisplayState | null; subs: Set<(s: DisplayState) => void>; touchedAt: number };
const channels = new Map<string, Channel>();
const channel = (code: string) => {
  let c = channels.get(code);
  if (!c) channels.set(code, (c = { state: null, subs: new Set(), touchedAt: Date.now() }));
  return c;
};

export const displayRoutes: FastifyPluginAsync = async (app) => {
  const sweep = setInterval(() => {
    const stale = Date.now() - 24 * 3600_000;
    for (const [code, c] of channels) if (!c.subs.size && c.touchedAt < stale) channels.delete(code);
  }, 3600_000);
  app.addHook('onClose', async () => clearInterval(sweep));

  app.put<{ Params: { code: string } }>('/display/:code', { preHandler: app.authenticate }, async (req, reply) => {
    if (!DISPLAY_CODE.test(req.params.code)) return reply.code(400).send({ error: 'invalid_code' });
    const body = DisplayState.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const c = channel(req.params.code);
    c.state = body.data;
    c.touchedAt = Date.now();
    c.subs.forEach((send) => send(body.data));
    return { ok: true, viewers: c.subs.size };
  });

  app.get<{ Params: { code: string } }>('/display/:code/stream', async (req, reply) => {
    if (!DISPLAY_CODE.test(req.params.code)) return reply.code(400).send({ error: 'invalid_code' });
    const c = channel(req.params.code);

    reply.hijack();
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no', // ปิด buffer ของ Nginx
    });
    const send = (s: DisplayState) => reply.raw.write(`data: ${JSON.stringify(s)}\n\n`);
    if (c.state) send(c.state);
    c.subs.add(send);
    const ping = setInterval(() => reply.raw.write(': ping\n\n'), 25_000);
    req.raw.on('close', () => {
      clearInterval(ping);
      c.subs.delete(send);
    });
  });
};
