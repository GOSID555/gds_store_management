import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { users } from '../../db/schema';

const Login = z.object({ username: z.string().trim().toLowerCase().min(1), password: z.string().min(1) });

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/auth/login', async (req, reply) => {
    const body = Login.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });

    const [u] = await app.db.select().from(users).where(eq(users.username, body.data.username)).limit(1);
    if (!u || !(await bcrypt.compare(body.data.password, u.passwordHash))) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }
    const user = { id: u.id, name: u.name, role: u.role };
    return { token: app.jwt.sign(user), user: { ...user, username: u.username } };
  });

  app.get('/auth/me', { preHandler: app.authenticate }, async (req) => req.user);
};
