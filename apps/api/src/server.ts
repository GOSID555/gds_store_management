import { buildApp } from './app';
import { ensureOwner } from './bootstrap';
import { createDb } from './db/client';
import { loadEnv } from './env';

const env = loadEnv();
const { db, close } = await createDb(env.DATABASE_URL);

const created = await ensureOwner(db, env.OWNER_USERNAME, env.OWNER_PASSWORD);
const app = await buildApp({ db, jwtSecret: env.JWT_SECRET, corsOrigin: env.CORS_ORIGIN, logger: true });
if (created) app.log.info(`สร้างบัญชีเจ้าของร้าน "${created}" แล้ว`);

const shutdown = async () => {
  await app.close();
  await close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: env.PORT, host: env.HOST });
