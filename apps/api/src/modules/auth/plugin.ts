import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '@pos/shared';

export type AuthUser = { id: string; name: string; role: Role };

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthUser;
    user: AuthUser;
  }
}
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireOwner: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const authPlugin = fp<{ secret: string }>(async (app, opts) => {
  await app.register(jwt, { secret: opts.secret, sign: { expiresIn: '30d' } });

  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'unauthorized' });
    }
  });
  app.decorate('requireOwner', async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.user?.role !== 'owner') return reply.code(403).send({ error: 'forbidden' });
  });
});
