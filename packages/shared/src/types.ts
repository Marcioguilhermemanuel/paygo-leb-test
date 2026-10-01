import { PaymentMethod, InternalPaymentStatus } from './constants.js';

export interface NormalizedApiResponse<T = any> {
  success: boolean;
  status: number;
  data?: T;
  error?: {
    code?: string;
    message: string;
    details?: any;
  };
  raw: any;
  durationMs: number;
  requestId: string;
}

export interface ApiLogEntry {
  id?: string;
  provider: string;
  endpoint: string;
  method: string;
  requestId: string;
  httpStatus: number;
  durationMs: number;
  success: boolean;
  sanitizedRequest: string;
  sanitizedResponse: string;
  errorCode?: string | null;
  createdAt?: Date;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  reason?: string;
  calculatedSignature?: string;
}
