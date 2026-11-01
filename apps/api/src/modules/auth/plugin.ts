import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '@pos/shared';
import { eq } from 'drizzle-orm';
import { GUEST_USERNAME } from '../../bootstrap';
import { users } from '../../db/schema';

/** tv = token version ของบัญชีตอนออก token (เปลี่ยนรหัส/ปิดบัญชี → เลขขยับ → token เก่าใช้ไม่ได้) */
export type AuthUser = { id: string; name: string; role: Role; tv?: number };

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthUser;
    user: AuthUser;
  }
}
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireOwner: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const authPlugin = fp<{ secret: string; requireLogin: boolean }>(async (app, opts) => {
  await app.register(jwt, { secret: opts.secret, sign: { expiresIn: '30d' } });

  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    // ตรวจกับฐานข้อมูลทุกครั้ง: บัญชียังใช้ได้อยู่ไหม, token ยังเป็นรุ่นล่าสุดไหม, สิทธิ์ล่าสุดคืออะไร
    const [u] = await app.db
      .select({ role: users.role, username: users.username, disabled: users.disabled, tv: users.tokenVersion })
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);
    if (!u || u.disabled || (req.user.tv ?? 0) !== u.tv) return reply.code(401).send({ error: 'unauthorized' });
    if (opts.requireLogin && u.username === GUEST_USERNAME) return reply.code(401).send({ error: 'login_required' });
    req.user.role = u.role;
  });
  app.decorate('requireOwner', async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.user?.role !== 'owner') return reply.code(403).send({ error: 'forbidden' });
  });
});
