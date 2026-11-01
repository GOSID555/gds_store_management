import type { IncomingMessage, ServerResponse } from 'node:http';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app';
import { createDb } from './db/client';
import { loadEnv } from './env';

/**
 * Entry ของ Vercel Serverless Function (api/index.js เรียกใช้)
 * สร้าง Fastify + pool ครั้งเดียวต่อ instance แล้วใช้ซ้ำระหว่าง request
 * migration และบัญชีเจ้าของร้านจัดการตอน build (src/migrate.ts) ไม่ใช่ที่นี่
 */
let ready: Promise<FastifyInstance> | null = null;

async function init() {
  const env = loadEnv();
  if (!env.DATABASE_URL || env.DATABASE_URL.startsWith('pglite:')) {
    throw new Error('ตั้ง DATABASE_URL เป็น PostgreSQL (เช่น Neon) ใน Vercel → Settings → Environment Variables');
  }
  const { db } = await createDb(env.DATABASE_URL, { migrate: false, poolMax: 3 });
  const app = await buildApp({ db, jwtSecret: env.JWT_SECRET, requireLogin: env.REQUIRE_LOGIN, corsOrigin: env.CORS_ORIGIN });
  await app.ready();
  return app;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  ready ??= init().catch((e) => {
    ready = null; // ให้ request ถัดไปลองใหม่
    throw e;
  });
  try {
    const app = await ready;
    app.server.emit('request', req, res);
  } catch (e) {
    console.error(e);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'server_not_configured' }));
  }
}
