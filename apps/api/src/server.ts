import { buildApp } from './app';
import { ensureOwner } from './bootstrap';
import { createDb } from './db/client';
import { loadEnv } from './env';

const env = loadEnv();
const { db, close } = await createDb(env.DATABASE_URL);

const created = env.REQUIRE_LOGIN || env.OWNER_PASSWORD ? await ensureOwner(db, env.OWNER_USERNAME, env.OWNER_PASSWORD) : null;
const app = await buildApp({ db, jwtSecret: env.JWT_SECRET, requireLogin: env.REQUIRE_LOGIN, corsOrigin: env.CORS_ORIGIN, logger: true });
if (created) app.log.info(`สร้างบัญชีเจ้าของร้าน "${created}" แล้ว`);
if (!env.REQUIRE_LOGIN) app.log.warn('โหมดทดลอง: ไม่ต้องเข้าสู่ระบบ ใครเปิดเว็บก็ใช้ได้ในสิทธิ์เจ้าของร้าน (ตั้ง REQUIRE_LOGIN=true เพื่อปิด)');

const shutdown = async () => {
  await app.close();
  await close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: env.PORT, host: env.HOST });
