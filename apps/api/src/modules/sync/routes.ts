import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { PushRequest, type PushResponse } from '@pos/shared';
import { applyMutations } from './apply';
import { pullChanges } from './pull';

export const syncRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.post('/sync/push', async (req, reply): Promise<PushResponse | void> => {
    const body = PushRequest.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request', issues: body.error.issues });
    return { results: await applyMutations(app.db, req.user, body.data.mutations) };
  });

  const PullQuery = z.object({ since: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(1).max(1000).default(500) });
  app.get('/sync/pull', async (req, reply) => {
    const q = PullQuery.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: 'invalid_request' });
    return pullChanges(app.db, q.data.since, q.data.limit);
  });
};
