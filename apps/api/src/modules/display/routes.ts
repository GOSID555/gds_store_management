import { and, eq, gt, sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { DISPLAY_CODE, DisplayState } from '@pos/shared';
import { displayStates } from '../../db/schema';

/**
 * ส่งต่อสถานะบิลจากเครื่องแคชเชียร์ไปยังจอลูกค้า
 *
 * - เก็บแถวเดียวต่อรหัสจับคู่ใน Postgres (ทำงานได้บน serverless ที่ไม่มีหน่วยความจำร่วม)
 * - จอลูกค้า poll ทุก ~1 วินาทีด้วย ?after=<version> ถ้าไม่มีอะไรใหม่ได้ 204 (เบามาก)
 * - จอลูกค้าไม่ต้องเข้าสู่ระบบ อ่านได้ด้วยรหัสจับคู่ (สุ่ม, เดายาก) และเห็นแค่ตะกร้าปัจจุบัน
 */
export const displayRoutes: FastifyPluginAsync = async (app) => {
  app.put<{ Params: { code: string } }>('/display/:code', { preHandler: app.authenticate }, async (req, reply) => {
    if (!DISPLAY_CODE.test(req.params.code)) return reply.code(400).send({ error: 'invalid_code' });
    const body = DisplayState.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const [row] = await app.db
      .insert(displayStates)
      .values({ code: req.params.code, state: body.data })
      .onConflictDoUpdate({
        target: displayStates.code,
        set: { state: body.data, version: sql`${displayStates.version} + 1`, updatedAt: sql`now()` },
      })
      .returning({ version: displayStates.version });
    return { ok: true, version: row!.version };
  });

  app.get<{ Params: { code: string }; Querystring: { after?: string } }>('/display/:code', async (req, reply) => {
    if (!DISPLAY_CODE.test(req.params.code)) return reply.code(400).send({ error: 'invalid_code' });
    const after = Number(req.query.after) || 0;
    const [row] = await app.db
      .select({ state: displayStates.state, version: displayStates.version })
      .from(displayStates)
      .where(and(eq(displayStates.code, req.params.code), gt(displayStates.version, after)))
      .limit(1);
    reply.header('cache-control', 'no-store');
    if (!row) return reply.code(204).send();
    return row;
  });
};
