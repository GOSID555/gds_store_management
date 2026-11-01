import bcrypt from 'bcryptjs';
import { eq, ne, sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { GUEST_USERNAME, ensureGuest } from '../../bootstrap';
import { users } from '../../db/schema';

const Login = z.object({ username: z.string().trim().toLowerCase().min(1), password: z.string().min(1) });
const Setup = z.object({
  name: z.string().trim().min(1).max(60).default('เจ้าของร้าน'),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_.-]{3,32}$/),
  password: z.string().min(6).max(128),
});

const ChangePassword = z.object({ current: z.string().min(1), next: z.string().min(6).max(128) });

type UserRow = typeof users.$inferSelect;
/** ออก token พร้อมข้อมูลผู้ใช้สำหรับหน้าเว็บ */
const issue = (app: Parameters<FastifyPluginAsync>[0], u: Pick<UserRow, 'id' | 'name' | 'role' | 'username' | 'tokenVersion'>) => {
  const user = { id: u.id, name: u.name, role: u.role };
  return { token: app.jwt.sign({ ...user, tv: u.tokenVersion }), user: { ...user, username: u.username } };
};

/** ร้านยังไม่มีบัญชีจริงเลย (ไม่นับบัญชีกลางโหมดทดลอง) */
const hasAccounts = async (db: Parameters<FastifyPluginAsync>[0]['db']) =>
  (await db.select({ id: users.id }).from(users).where(ne(users.username, GUEST_USERNAME)).limit(1)).length > 0;

export const authRoutes: FastifyPluginAsync<{ requireLogin: boolean }> = async (app, opts) => {
  app.post('/auth/login', async (req, reply) => {
    const body = Login.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });

    const [u] = await app.db.select().from(users).where(eq(users.username, body.data.username)).limit(1);
    if (!u || u.disabled || u.username === GUEST_USERNAME || !(await bcrypt.compare(body.data.password, u.passwordHash))) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }
    return issue(app, u);
  });

  /** หน้าเว็บถามก่อนว่าจะแสดงอะไร: ฟอร์มล็อกอิน / ตั้งบัญชีเจ้าของร้านครั้งแรก / เข้าเลย (โหมดทดลอง) */
  app.get('/auth/status', async () => ({
    requireLogin: opts.requireLogin,
    needsSetup: opts.requireLogin && !(await hasAccounts(app.db)),
  }));

  /**
   * ตั้งบัญชีเจ้าของร้านครั้งแรก — ใช้ได้ครั้งเดียว ตอนร้านยังไม่มีบัญชีเลย
   * ล็อกด้วย advisory lock กันสองคนกดพร้อมกันแล้วได้เจ้าของสองคน
   */
  app.post('/auth/setup', async (req, reply) => {
    const body = Setup.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const { password, ...rest } = body.data;
    const hash = await bcrypt.hash(password, 10);
    const u = await app.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(7002)`);
      if ((await tx.select({ id: users.id }).from(users).where(ne(users.username, GUEST_USERNAME)).limit(1)).length) return null;
      const [row] = await tx.insert(users).values({ ...rest, passwordHash: hash, role: 'owner' }).returning();
      return row!;
    });
    if (!u) return reply.code(409).send({ error: 'already_set_up' });
    return issue(app, u);
  });

  /** โหมดทดลอง: ออก token ของบัญชีกลางให้เลย หน้าเว็บจึงไม่ต้องแสดงหน้าเข้าสู่ระบบ */
  app.post('/auth/guest', async (_req, reply) => {
    if (opts.requireLogin) return reply.code(404).send({ error: 'login_required' });
    return issue(app, await ensureGuest(app.db));
  });

  /** เปลี่ยนรหัสผ่านของตัวเอง → เครื่องอื่นที่ล็อกอินบัญชีนี้ถูกออกจากระบบ เครื่องนี้ได้ token ใหม่ */
  app.post('/auth/password', { preHandler: app.authenticate }, async (req, reply) => {
    const body = ChangePassword.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const [u] = await app.db.select().from(users).where(eq(users.id, req.user.id)).limit(1);
    if (!u || !(await bcrypt.compare(body.data.current, u.passwordHash))) return reply.code(401).send({ error: 'wrong_password' });
    const [next] = await app.db
      .update(users)
      .set({ passwordHash: await bcrypt.hash(body.data.next, 10), tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(eq(users.id, u.id))
      .returning();
    return issue(app, next!);
  });

  app.get('/auth/me', { preHandler: app.authenticate }, async (req) => req.user);
};
