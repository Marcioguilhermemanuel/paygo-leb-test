import { FastifyPluginAsync } from 'fastify';
import { env, isPayGoConfigured, isLiveMode } from '../config/env.js';
import { requestLogRepository } from '../repositories/index.js';
import { checkDatabaseConnection } from '../lib/prisma.js';
import { payGoClient } from '../lib/paygo-client.js';

export const systemRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /health
  fastify.get('/health', async (_request, reply) => {
    const isDbConnected = await checkDatabaseConnection();
    const hasApiKey = isPayGoConfigured();

    let paygoReachable = false;
    if (hasApiKey) {
      try {
        const prodCheck = await payGoClient.listProducts();
        paygoReachable = prodCheck.status !== 500 && prodCheck.status !== 408;
      } catch {
        paygoReachable = false;
      }
    }

    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      mode: env.PAYGO_MODE,
      isLive: isLiveMode(),
      databaseConnected: isDbConnected,
      paygoConfigured: hasApiKey,
      paygoReachable,
      baseUrl: env.PAYGO_BASE_URL,
    });
  });

  // GET /api/logs
  fastify.get('/api/logs', async (request, reply) => {
    const { limit } = request.query as { limit?: string };
    const logs = await requestLogRepository.list(limit ? Number(limit) : 50);
    return reply.send({ logs });
  });
};
