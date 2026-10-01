import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env from workspace root if present
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config(); // also check current dir fallback

const envSchema = z.object({
  PAYGO_BASE_URL: z
    .string()
    .url()
    .default('https://rouxavcvorjiwhpjhsye.supabase.co/functions/v1/api-v1'),
  PAYGO_API_KEY: z.string().optional().default(''),
  PAYGO_WEBHOOK_SECRET: z.string().optional().default(''),
  PAYGO_MODE: z.enum(['test', 'live']).default('test'),
  DATABASE_URL: z.string().optional().default(''),
  APP_URL: z.string().default('http://localhost:3000'),
  API_PORT: z.coerce.number().default(3333),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export const env = envSchema.parse(process.env);

export const isLiveMode = () => env.PAYGO_MODE === 'live';
export const isPayGoConfigured = () => Boolean(env.PAYGO_API_KEY && env.PAYGO_API_KEY.trim().length > 0);
