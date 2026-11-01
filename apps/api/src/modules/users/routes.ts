import bcrypt from 'bcryptjs';
import { and, eq, ne, sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Role } from '@pos/shared';
import { GUEST_USERNAME } from '../../bootstrap';
import { users } from '../../db/schema';

const CreateUser = z.object({
  name: z.string().trim().min(1).max(60),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_.-]{3,32}$/),
  password: z.string().min(6).max(128),
  role: Role.default('cashier'),
});

const UpdateUser = z.object({ password: z.string().min(6).max(128).optional(), disabled: z.boolean().optional() });

/** เจ้าของร้านจัดการบัญชีพนักงาน */
export const userRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', app.requireOwner);

  app.get('/users', async () =>
    app.db
      .select({ id: users.id, name: users.name, username: users.username, role: users.role, disabled: users.disabled })
      .from(users)
      .where(ne(users.username, GUEST_USERNAME))
      .orderBy(users.createdAt),
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

  /** ตั้งรหัสใหม่ให้พนักงาน / ปิด-เปิดบัญชี — ทั้งสองอย่างทำให้ทุกเครื่องของบัญชีนั้นถูกออกจากระบบ */
  app.patch<{ Params: { id: string } }>('/users/:id', async (req, reply) => {
    const body = UpdateUser.safeParse(req.body);
    if (!body.success || (body.data.password === undefined && body.data.disabled === undefined)) return reply.code(400).send({ error: 'invalid_request' });
    if (req.params.id === req.user.id) return reply.code(400).send({ error: 'use_own_password_page' });
    const [u] = await app.db
      .update(users)
      .set({
        tokenVersion: sql`${users.tokenVersion} + 1`,
        ...(body.data.password ? { passwordHash: await bcrypt.hash(body.data.password, 10) } : {}),
        ...(body.data.disabled !== undefined ? { disabled: body.data.disabled } : {}),
      })
      .where(and(eq(users.id, req.params.id), ne(users.username, GUEST_USERNAME)))
      .returning({ id: users.id, name: users.name, username: users.username, role: users.role, disabled: users.disabled });
    if (!u) return reply.code(404).send({ error: 'not_found' });
    return u;
  });
};
