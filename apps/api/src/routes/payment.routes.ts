import { FastifyPluginAsync } from 'fastify';
import { CreatePaymentInputSchema } from '@paygo/shared';
import { paymentService } from '../services/index.js';

export const paymentRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /test/payments
  fastify.post('/test/payments', async (request, reply) => {
    const parseResult = CreatePaymentInputSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        details: parseResult.error.flatten(),
      });
    }

    const result = await paymentService.createTestPayment(parseResult.data);

    if (!result.success) {
      const statusCode = result.errorCode === 'LIVE_CONFIRMATION_REQUIRED' ? 403 : 502;
      return reply.status(statusCode).send(result);
    }

    return reply.status(201).send(result);
  });

  // GET /test/payments/:id/status
  fastify.get('/test/payments/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const result = await paymentService.checkPaymentStatus(id);
      return reply.send(result);
    } catch (error: any) {
      return reply.status(404).send({
        error: error.message || 'Payment not found',
      });
    }
  });

  // GET /test/payments
  fastify.get('/test/payments', async (request, reply) => {
    const { limit } = request.query as { limit?: string };
    const payments = await paymentService.listPayments(limit ? Number(limit) : 50);
    return reply.send({ payments });
  });

  // GET /test/payments/:id
  fastify.get('/test/payments/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const payment = await paymentService.getPayment(id);
    if (!payment) {
      return reply.status(404).send({ error: 'Payment not found' });
    }
    return reply.send({ payment });
  });
};
