import { FastifyPluginAsync } from 'fastify';
import { webhookService } from '../services/index.js';

export const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /webhooks/paygo
  fastify.post('/webhooks/paygo', async (request, reply) => {
    // fastify-raw-body populates request.rawBody if enabled
    const rawBody = (request as any).rawBody || JSON.stringify(request.body || {});
    const signature =
      (request.headers['x-webhook-signature'] as string) ||
      (request.headers['x-signature'] as string) ||
      null;

    const result = await webhookService.processWebhook(rawBody, signature);
    return reply.status(result.status).send(result);
  });

  // GET /webhooks/stats
  fastify.get('/webhooks/stats', async (_request, reply) => {
    const stats = await webhookService.getStats();
    return reply.send(stats);
  });

  // GET /webhooks/events
  fastify.get('/webhooks/events', async (request, reply) => {
    const { limit } = request.query as { limit?: string };
    const events = await webhookService.listEvents(limit ? Number(limit) : 50);
    return reply.send({ events });
  });
};
