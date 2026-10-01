import Fastify from 'fastify';
import cors from '@fastify/cors';
import rawBody from 'fastify-raw-body';
import rateLimit from '@fastify/rate-limit';
import { env, isLiveMode, isPayGoConfigured } from './config/env.js';
import { logger } from './lib/logger.js';
import { productRoutes } from './routes/product.routes.js';
import { paymentRoutes } from './routes/payment.routes.js';
import { webhookRoutes } from './routes/webhook.routes.js';
import { systemRoutes } from './routes/system.routes.js';

export async function buildServer() {
  const fastify = Fastify({
    logger: false, // We use our custom sanitized logger
    bodyLimit: 1048576, // 1MB body limit
  });

  // CORS
  await fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // Raw body plugin - critical for HMAC signature verification
  await fastify.register(rawBody, {
    field: 'rawBody',
    global: true,
    encoding: 'utf8',
    runFirst: true,
  });

  // Rate limiting (Section 40)
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Global error handler
  fastify.setErrorHandler((error, request, reply) => {
    logger.error('Unhandled server error', error, {
      url: request.url,
      method: request.method,
    });
    return reply.status(error.statusCode || 500).send({
      error: error.name || 'InternalServerError',
      message: error.message || 'An unexpected error occurred',
    });
  });

  // Register routes both with /api and root prefixes for maximum compatibility
  await fastify.register(systemRoutes);
  await fastify.register(productRoutes);
  await fastify.register(paymentRoutes);
  await fastify.register(webhookRoutes);

  await fastify.register(systemRoutes, { prefix: '/api' });
  await fastify.register(productRoutes, { prefix: '/api' });
  await fastify.register(paymentRoutes, { prefix: '/api' });
  await fastify.register(webhookRoutes, { prefix: '/api' });

  return fastify;
}

async function start() {
  try {
    const server = await buildServer();
    const port = env.API_PORT;
    const host = '0.0.0.0';

    await server.listen({ port, host });

    logger.info(`====================================================`);
    logger.info(` PAYGO INTEGRATION LAB API IS RUNNING               `);
    logger.info(` Port: ${port} | Host: ${host}                       `);
    logger.info(` Mode: ${env.PAYGO_MODE.toUpperCase()} ${isLiveMode() ? '⚠️ LIVE TRANSACTIONS ENABLED' : '(SAFE LAB)'}`);
    logger.info(` PayGo Configured: ${isPayGoConfigured() ? 'YES' : 'NO (Add PAYGO_API_KEY to .env)'}`);
    logger.info(`====================================================`);
  } catch (err) {
    logger.error('Failed to start API server', err);
    process.exit(1);
  }
}

// If executed directly, run the server
if (process.argv[1] && process.argv[1].endsWith('server.ts')) {
  start();
}
