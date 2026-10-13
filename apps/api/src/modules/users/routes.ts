import bcrypt from 'bcryptjs';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Role } from '@pos/shared';
import { users } from '../../db/schema';

const CreateUser = z.object({
  name: z.string().trim().min(1).max(60),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_.-]{3,32}$/),
  password: z.string().min(6).max(128),
  role: Role.default('cashier'),
});

/** เจ้าของร้านจัดการบัญชีพนักงาน */
export const userRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', app.requireOwner);

  app.get('/users', async () =>
    app.db.select({ id: users.id, name: users.name, username: users.username, role: users.role }).from(users).orderBy(users.createdAt),
  );

  app.post('/users', async (req, reply) => {
    const body = CreateUser.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request', issues: body.error.issues });
    const { password, ...rest } = body.data;
    const [u] = await app.db
      .insert(users)
      .values({ ...rest, passwordHash: await bcrypt.hash(password, 10) })
      .onConflictDoNothing()
      .returning({ id: users.id, name: users.name, username: users.username, role: users.role });
    if (!u) return reply.code(409).send({ error: 'username_taken' });
    return reply.code(201).send(u);
  });
};
