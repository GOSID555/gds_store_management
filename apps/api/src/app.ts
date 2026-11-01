import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { Db } from './db/client';
import { authPlugin } from './modules/auth/plugin';
import { authRoutes } from './modules/auth/routes';
import { displayRoutes } from './modules/display/routes';
import { syncRoutes } from './modules/sync/routes';
import { userRoutes } from './modules/users/routes';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
  }
}

export type AppOptions = { db: Db; jwtSecret: string; requireLogin?: boolean; corsOrigin?: string; logger?: boolean };

export async function buildApp(opts: AppOptions) {
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 8 * 1024 * 1024 });
  app.decorate('db', opts.db);

  await app.register(cors, { origin: opts.corsOrigin?.split(',') ?? true });
  await app.register(authPlugin, { secret: opts.jwtSecret, requireLogin: opts.requireLogin ?? true });

  app.get('/health', async () => ({ ok: true }));
  await app.register(
    async (api) => {
      await api.register(authRoutes, { requireLogin: opts.requireLogin ?? true });
      await api.register(syncRoutes);
      await api.register(userRoutes);
      await api.register(displayRoutes);
    },
    { prefix: '/api' },
  );
  return app;
}
