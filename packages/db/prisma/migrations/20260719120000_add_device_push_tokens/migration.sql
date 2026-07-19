-- Mobile auth (feat/mobile-auth): Expo push-notification device tokens.
-- Additive-only, public-schema global entity (mirrors media_objects style).
-- Reversible via: DROP TABLE "public"."device_push_tokens";

-- CreateTable
CREATE TABLE "public"."device_push_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "device_push_tokens_tenant_id_idx" ON "public"."device_push_tokens"("tenant_id");

-- CreateIndex
CREATE INDEX "device_push_tokens_token_idx" ON "public"."device_push_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "device_push_tokens_user_id_token_key" ON "public"."device_push_tokens"("user_id", "token");

-- AddForeignKey
ALTER TABLE "public"."device_push_tokens" ADD CONSTRAINT "device_push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."device_push_tokens" ADD CONSTRAINT "device_push_tokens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
