-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('client', 'livreur', 'both', 'admin');

-- CreateEnum
CREATE TYPE "CountryCode" AS ENUM ('GHA', 'TGO', 'BEN');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('moto', 'voiture', 'camionnette');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('draft', 'published', 'offers_received', 'accepted', 'driver_en_route', 'picked_up', 'in_transit', 'delivered', 'cancelled', 'disputed');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('pending', 'accepted', 'rejected', 'expired');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('in_progress', 'completed', 'cancelled', 'disputed');

-- CreateEnum
CREATE TYPE "ClientPaymentStatus" AS ENUM ('pending', 'escrow_held', 'released', 'refunded');

-- CreateEnum
CREATE TYPE "DriverPayoutStatus" AS ENUM ('pending', 'processed', 'withdrawn');

-- CreateEnum
CREATE TYPE "RatingRole" AS ENUM ('client', 'livreur');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('payment_in', 'escrow_release', 'commission', 'litigation_fee', 'driver_payout', 'withdrawal', 'refund', 'adjustment');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('pending', 'completed', 'failed', 'reversed');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('GHS', 'XOF');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('momo', 'card', 'bank_transfer', 'cash');

-- CreateEnum
CREATE TYPE "WithdrawalMethod" AS ENUM ('momo', 'bank_transfer');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('registration', 'login', 'password_reset', 'phone_verification');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('order', 'offer', 'delivery', 'payment', 'withdrawal', 'rating', 'system');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "age" INTEGER,
    "id_card_photo" TEXT,
    "profile_photo" TEXT,
    "role" "Role" NOT NULL,
    "country_code" "CountryCode" NOT NULL,
    "city" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "verified_by_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "driver_license_number" TEXT,
    "driver_license_photo" TEXT,
    "driver_qr_code" TEXT,
    "vehicle_type" "VehicleType",
    "vehicle_registration" TEXT,
    "vehicle_photo" TEXT,
    "location_lat" DECIMAL(10,8),
    "location_lng" DECIMAL(11,8),
    "location_updated_at" TIMESTAMP(3),
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "rating_driver" DECIMAL(2,1) NOT NULL DEFAULT 5.0,
    "rating_client" DECIMAL(2,1) NOT NULL DEFAULT 5.0,
    "total_deliveries" INTEGER NOT NULL DEFAULT 0,
    "daily_deliveries" INTEGER NOT NULL DEFAULT 0,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fcm_token" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "pickup_address" TEXT NOT NULL,
    "pickup_lat" DECIMAL(10,8) NOT NULL,
    "pickup_lng" DECIMAL(11,8) NOT NULL,
    "delivery_address" TEXT NOT NULL,
    "delivery_lat" DECIMAL(10,8) NOT NULL,
    "delivery_lng" DECIMAL(11,8) NOT NULL,
    "description" TEXT,
    "package_photo" TEXT,
    "weight_kg" DECIMAL(6,2),
    "dimensions" TEXT,
    "scheduled_time" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "status" "OrderStatus" NOT NULL DEFAULT 'draft',
    "min_price_suggested" DECIMAL(10,2),
    "distance_km" DECIMAL(6,2),
    "accepted_offer_id" UUID,
    "reminded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "cancel_reason" TEXT,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "livreur_id" UUID NOT NULL,
    "proposed_price" DECIMAL(10,2) NOT NULL,
    "min_price" DECIMAL(10,2) NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "livreur_id" UUID NOT NULL,
    "pickup_photo" TEXT,
    "pickup_photo_taken_at" TIMESTAMP(3),
    "delivery_photo" TEXT,
    "delivery_confirmed_at" TIMESTAMP(3),
    "start_time" TIMESTAMP(3),
    "pickup_time" TIMESTAMP(3),
    "delivery_time" TIMESTAMP(3),
    "distance_km" DECIMAL(6,2),
    "base_price" DECIMAL(10,2),
    "commission_rate" DECIMAL(4,2),
    "commission_amount" DECIMAL(10,2),
    "litigation_fee" DECIMAL(6,2) NOT NULL DEFAULT 1.00,
    "net_earnings" DECIMAL(10,2),
    "client_payment_status" "ClientPaymentStatus" NOT NULL DEFAULT 'pending',
    "driver_payout_status" "DriverPayoutStatus" NOT NULL DEFAULT 'pending',
    "status" "DeliveryStatus" NOT NULL DEFAULT 'in_progress',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ratings" (
    "id" UUID NOT NULL,
    "delivery_id" UUID NOT NULL,
    "from_user_id" UUID NOT NULL,
    "to_user_id" UUID NOT NULL,
    "role_type" "RatingRole" NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "delivery_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "receiver_id" UUID NOT NULL,
    "message_text" TEXT,
    "image_url" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "delivery_id" UUID,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'GHS',
    "status" "TransactionStatus" NOT NULL DEFAULT 'pending',
    "reference" TEXT,
    "payment_method" "PaymentMethod",
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawals" (
    "id" UUID NOT NULL,
    "livreur_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "WithdrawalMethod" NOT NULL,
    "account_details" JSONB NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'pending',
    "fee_amount" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "processed_by" UUID,
    "rejection_reason" TEXT,

    CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "country_configs" (
    "id" UUID NOT NULL,
    "country_code" "CountryCode" NOT NULL,
    "country_name" TEXT NOT NULL,
    "currency_code" "Currency" NOT NULL,
    "currency_symbol" TEXT NOT NULL,
    "price_per_km" DECIMAL(6,2) NOT NULL DEFAULT 1.00,
    "base_pickup_fee" DECIMAL(8,2) NOT NULL DEFAULT 2.00,
    "commission_tier1" DECIMAL(4,2) NOT NULL DEFAULT 0.20,
    "commission_tier2" DECIMAL(4,2) NOT NULL DEFAULT 0.15,
    "commission_tier3" DECIMAL(4,2) NOT NULL DEFAULT 0.12,
    "commission_tier4" DECIMAL(4,2) NOT NULL DEFAULT 0.09,
    "litigation_fee" DECIMAL(6,2) NOT NULL DEFAULT 1.00,
    "search_radius_km" INTEGER NOT NULL DEFAULT 5,
    "scheduled_publish_buffer_min" INTEGER NOT NULL DEFAULT 30,
    "reminder_before_min" INTEGER NOT NULL DEFAULT 60,
    "withdrawal_methods" JSONB NOT NULL,
    "momo_providers" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "country_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "litigation_fund" (
    "id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "balance_after" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "litigation_fund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" UUID NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "code_hash" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_country_code_idx" ON "users"("country_code");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "orders_accepted_offer_id_key" ON "orders"("accepted_offer_id");

-- CreateIndex
CREATE INDEX "orders_client_id_idx" ON "orders"("client_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "offers_order_id_idx" ON "offers"("order_id");

-- CreateIndex
CREATE INDEX "offers_livreur_id_idx" ON "offers"("livreur_id");

-- CreateIndex
CREATE UNIQUE INDEX "offers_order_id_livreur_id_key" ON "offers"("order_id", "livreur_id");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_order_id_key" ON "deliveries"("order_id");

-- CreateIndex
CREATE INDEX "deliveries_livreur_id_idx" ON "deliveries"("livreur_id");

-- CreateIndex
CREATE INDEX "ratings_to_user_id_idx" ON "ratings"("to_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ratings_delivery_id_from_user_id_key" ON "ratings"("delivery_id", "from_user_id");

-- CreateIndex
CREATE INDEX "messages_delivery_id_idx" ON "messages"("delivery_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_reference_key" ON "transactions"("reference");

-- CreateIndex
CREATE INDEX "transactions_user_id_idx" ON "transactions"("user_id");

-- CreateIndex
CREATE INDEX "transactions_delivery_id_idx" ON "transactions"("delivery_id");

-- CreateIndex
CREATE INDEX "transactions_type_idx" ON "transactions"("type");

-- CreateIndex
CREATE INDEX "withdrawals_livreur_id_idx" ON "withdrawals"("livreur_id");

-- CreateIndex
CREATE UNIQUE INDEX "country_configs_country_code_key" ON "country_configs"("country_code");

-- CreateIndex
CREATE INDEX "otp_codes_phone_idx" ON "otp_codes"("phone");

-- CreateIndex
CREATE INDEX "otp_codes_email_idx" ON "otp_codes"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_replaced_by_id_key" ON "refresh_tokens"("replaced_by_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_accepted_offer_id_fkey" FOREIGN KEY ("accepted_offer_id") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_livreur_id_fkey" FOREIGN KEY ("livreur_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_livreur_id_fkey" FOREIGN KEY ("livreur_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_livreur_id_fkey" FOREIGN KEY ("livreur_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "litigation_fund" ADD CONSTRAINT "litigation_fund_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "litigation_fund" ADD CONSTRAINT "litigation_fund_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "refresh_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

