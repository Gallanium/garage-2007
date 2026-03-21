-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "telegram_id" BIGINT NOT NULL,
    "username" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "is_premium" BOOLEAN NOT NULL DEFAULT false,
    "language_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_saves" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nuts" INTEGER NOT NULL DEFAULT 0,
    "garage_level" INTEGER NOT NULL DEFAULT 1,
    "total_clicks" INTEGER NOT NULL DEFAULT 0,
    "total_earned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "milestones_purchased" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "click_power_level" INTEGER NOT NULL DEFAULT 0,
    "click_power_cost" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "work_speed_level" INTEGER NOT NULL DEFAULT 0,
    "work_speed_cost" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "apprentice_count" INTEGER NOT NULL DEFAULT 0,
    "apprentice_cost" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "mechanic_count" INTEGER NOT NULL DEFAULT 0,
    "mechanic_cost" DOUBLE PRECISION NOT NULL DEFAULT 5000,
    "master_count" INTEGER NOT NULL DEFAULT 0,
    "master_cost" DOUBLE PRECISION NOT NULL DEFAULT 50000,
    "brigadier_count" INTEGER NOT NULL DEFAULT 0,
    "brigadier_cost" DOUBLE PRECISION NOT NULL DEFAULT 500000,
    "director_count" INTEGER NOT NULL DEFAULT 0,
    "director_cost" DOUBLE PRECISION NOT NULL DEFAULT 5000000,
    "session_count" INTEGER NOT NULL DEFAULT 0,
    "last_session_date" TEXT NOT NULL DEFAULT '',
    "peak_click_income" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_play_time_seconds" INTEGER NOT NULL DEFAULT 0,
    "best_streak" INTEGER NOT NULL DEFAULT 0,
    "achievements" JSONB NOT NULL DEFAULT '{}',
    "daily_rewards" JSONB NOT NULL DEFAULT '{}',
    "rewarded_video" JSONB NOT NULL DEFAULT '{}',
    "boosts" JSONB NOT NULL DEFAULT '{}',
    "events" JSONB NOT NULL DEFAULT '{}',
    "decorations_owned" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "decorations_active" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "game_data_snapshot" JSONB,
    "last_sync_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 7,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_saves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "telegram_payment_id" TEXT NOT NULL,
    "pack_id" TEXT NOT NULL,
    "stars_amount" INTEGER NOT NULL,
    "nuts_amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balance_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "action_type" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balance_before" DOUBLE PRECISION NOT NULL,
    "balance_after" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "balance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_saves_user_id_key" ON "game_saves"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_telegram_payment_id_key" ON "transactions"("telegram_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_idempotency_key_key" ON "transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "transactions_user_id_idx" ON "transactions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "balance_logs_idempotency_key_key" ON "balance_logs"("idempotency_key");

-- CreateIndex
CREATE INDEX "balance_logs_user_id_created_at_idx" ON "balance_logs"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "game_saves" ADD CONSTRAINT "game_saves_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance_logs" ADD CONSTRAINT "balance_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
