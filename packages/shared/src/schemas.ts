import { z } from 'zod';
import { PAYMENT_METHODS } from './constants.js';

export const CreateProductInputSchema = z.object({
  name: z.string().min(1, 'Nome do produto é obrigatório'),
  price: z.number().positive('O valor deve ser positivo'),
  thank_you_url: z.string().url('URL de retorno inválida'),
  payment_multicaixa: z.boolean().default(true),
  payment_reference: z.boolean().default(true),
  payment_stripe: z.boolean().default(false),
});

export type CreateProductInput = z.infer<typeof CreateProductInputSchema>;

export const CartItemSchema = z.object({
  product_id: z.string().min(1, 'product_id é obrigatório'),
  quantity: z.number(),
});

export type CartItem = z.infer<typeof CartItemSchema>;

export const CreatePaymentInputSchema = z
  .object({
    product_id: z.string().min(1).optional(),
    items: z.array(CartItemSchema).optional(),
    payment_method: z.enum([
      PAYMENT_METHODS.MULTICAIXA,
      PAYMENT_METHODS.REFERENCE,
      PAYMENT_METHODS.STRIPE,
    ]),
    customer_name: z.string().min(1, 'Nome do cliente é obrigatório'),
    customer_email: z.string().email('E-mail inválido'),
    customer_phone: z.string().min(6, 'Telefone inválido'),
    order_bump_ids: z.array(z.string()).optional(),
    idempotency_key: z.string().optional(),
    confirmed_live: z.boolean().optional(),
  })
  .refine(
    (data) => (data.product_id && !data.items) || (!data.product_id && data.items && data.items.length > 0),
    {
      message: 'Deve fornecer ou "product_id" ou lista de "items" (carrinho), mas não ambos',
      path: ['product_id'],
    }
  );

export type CreatePaymentInput = z.infer<typeof CreatePaymentInputSchema>;

export const PayGoProductResponseSchema = z.object({
  id: z.string().optional(),
  product_id: z.string().optional(),
  name: z.string().optional(),
  price: z.union([z.number(), z.string()]).optional(),
}).passthrough();

export type PayGoProductResponse = z.infer<typeof PayGoProductResponseSchema>;

export const PayGoPaymentResponseSchema = z.object({
  id: z.string().optional(),
  payment_id: z.string().optional(),
  reference: z.string().optional(),
  entity: z.string().optional(),
  status: z.string().optional(),
  amount: z.union([z.number(), z.string()]).optional(),
  currency: z.string().optional(),
}).passthrough();

export type PayGoPaymentResponse = z.infer<typeof PayGoPaymentResponseSchema>;

export const PayGoStatusResponseSchema = z.object({
  id: z.string().optional(),
  payment_id: z.string().optional(),
  status: z.string(),
  amount: z.union([z.number(), z.string()]).optional(),
  currency: z.string().optional(),
  reference: z.string().optional(),
  entity: z.string().optional(),
}).passthrough();

export type PayGoStatusResponse = z.infer<typeof PayGoStatusResponseSchema>;
