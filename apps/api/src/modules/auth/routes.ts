import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { GUEST_USERNAME, ensureGuest } from '../../bootstrap';
import { users } from '../../db/schema';

const Login = z.object({ username: z.string().trim().toLowerCase().min(1), password: z.string().min(1) });

export const authRoutes: FastifyPluginAsync<{ requireLogin: boolean }> = async (app, opts) => {
  app.post('/auth/login', async (req, reply) => {
    const body = Login.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });

    const [u] = await app.db.select().from(users).where(eq(users.username, body.data.username)).limit(1);
    if (!u || u.username === GUEST_USERNAME || !(await bcrypt.compare(body.data.password, u.passwordHash))) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }
    const user = { id: u.id, name: u.name, role: u.role };
    return { token: app.jwt.sign(user), user: { ...user, username: u.username } };
  });

  /** โหมดทดลอง: ออก token ของบัญชีกลางให้เลย หน้าเว็บจึงไม่ต้องแสดงหน้าเข้าสู่ระบบ */
  app.post('/auth/guest', async (_req, reply) => {
    if (opts.requireLogin) return reply.code(404).send({ error: 'login_required' });
    const u = await ensureGuest(app.db);
    const user = { id: u.id, name: u.name, role: u.role };
    return { token: app.jwt.sign(user), user: { ...user, username: u.username } };
  });

  app.get('/auth/me', { preHandler: app.authenticate }, async (req) => req.user);
};
