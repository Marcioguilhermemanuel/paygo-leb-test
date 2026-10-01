import { FastifyPluginAsync } from 'fastify';
import { CreateProductInputSchema } from '@paygo/shared';
import { productService } from '../services/index.js';

export const productRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /test/products (also alias /api/test/products)
  fastify.post('/test/products', async (request, reply) => {
    const parseResult = CreateProductInputSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        details: parseResult.error.flatten(),
      });
    }

    const result = await productService.createTestProduct(parseResult.data);
    if (!result.success) {
      return reply.status(502).send({
        error: result.error,
        paygoResponse: result.paygoResponse,
      });
    }

    return reply.status(201).send(result);
  });

  // GET /test/products
  fastify.get('/test/products', async (_request, reply) => {
    const products = await productService.listProducts();
    return reply.send({ products });
  });

  // GET /test/products/paygo (direct from PayGo to compare)
  fastify.get('/test/products/paygo', async (_request, reply) => {
    const result = await productService.listPayGoProducts();
    return reply.status(result.status).send(result);
  });
};
