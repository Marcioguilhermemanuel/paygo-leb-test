-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'UNKNOWN', 'AMOUNT_MISMATCH');

-- CreateTable
CREATE TABLE "api_request_logs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'paygo',
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "http_status" INTEGER NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "sanitized_request" TEXT NOT NULL,
    "sanitized_response" TEXT NOT NULL,
    "error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_request_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_products" (
    "id" TEXT NOT NULL,
    "paygo_product_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "payment_multicaixa" BOOLEAN NOT NULL DEFAULT true,
    "payment_reference" BOOLEAN NOT NULL DEFAULT true,
    "payment_stripe" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_payments" (
    "id" TEXT NOT NULL,
    "paygo_payment_id" TEXT,
    "test_product_id" TEXT,
    "payment_method" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AOA',
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "customer_name" TEXT NOT NULL,
    "customer_email" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "items_json" TEXT,
    "raw_paygo_response" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "test_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'paygo',
    "signature" TEXT NOT NULL,
    "signature_valid" BOOLEAN NOT NULL,
    "event_hash" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processing_error" TEXT,
    "payment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "api_request_logs_request_id_idx" ON "api_request_logs"("request_id");

-- CreateIndex
CREATE INDEX "api_request_logs_endpoint_idx" ON "api_request_logs"("endpoint");

-- CreateIndex
CREATE INDEX "api_request_logs_created_at_idx" ON "api_request_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "test_products_paygo_product_id_key" ON "test_products"("paygo_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "test_payments_paygo_payment_id_key" ON "test_payments"("paygo_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "test_payments_idempotency_key_key" ON "test_payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "test_payments_status_idx" ON "test_payments"("status");

-- CreateIndex
CREATE INDEX "test_payments_paygo_payment_id_idx" ON "test_payments"("paygo_payment_id");

-- CreateIndex
CREATE INDEX "webhook_events_event_hash_idx" ON "webhook_events"("event_hash");

-- CreateIndex
CREATE INDEX "webhook_events_payment_id_idx" ON "webhook_events"("payment_id");

-- CreateIndex
CREATE INDEX "webhook_events_signature_valid_idx" ON "webhook_events"("signature_valid");

-- AddForeignKey
ALTER TABLE "test_payments" ADD CONSTRAINT "test_payments_test_product_id_fkey" FOREIGN KEY ("test_product_id") REFERENCES "test_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
