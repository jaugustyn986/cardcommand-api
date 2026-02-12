CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "games" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "games_slug_key" ON "games"("slug");

CREATE TABLE "tcg_sets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "game_id" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "provider_set_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "release_date" TIMESTAMP(3),
  "series" TEXT,
  "total" INTEGER,
  "images" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tcg_sets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tcg_sets_game_id_provider_provider_set_id_key" ON "tcg_sets"("game_id", "provider", "provider_set_id");
CREATE INDEX "tcg_sets_game_id_release_date_idx" ON "tcg_sets"("game_id", "release_date" DESC);
CREATE INDEX "tcg_sets_provider_provider_set_id_idx" ON "tcg_sets"("provider", "provider_set_id");

CREATE TABLE "tcg_cards" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "game_id" UUID NOT NULL,
  "set_id" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "provider_card_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "number" TEXT,
  "rarity" TEXT,
  "images" JSONB,
  "tcgplayer_id" TEXT,
  "scryfall_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tcg_cards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tcg_cards_game_id_provider_provider_card_id_key" ON "tcg_cards"("game_id", "provider", "provider_card_id");
CREATE INDEX "tcg_cards_set_id_rarity_idx" ON "tcg_cards"("set_id", "rarity");
CREATE INDEX "tcg_cards_name_idx" ON "tcg_cards"("name");
CREATE INDEX "tcg_cards_tcgplayer_id_idx" ON "tcg_cards"("tcgplayer_id");
CREATE INDEX "tcg_cards_scryfall_id_idx" ON "tcg_cards"("scryfall_id");

CREATE TABLE "price_latest" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "card_id" UUID NOT NULL,
  "source" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "market" DOUBLE PRECISION,
  "low" DOUBLE PRECISION,
  "mid" DOUBLE PRECISION,
  "high" DOUBLE PRECISION,
  "direct_low" DOUBLE PRECISION,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "price_latest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "price_latest_card_id_source_currency_key" ON "price_latest"("card_id", "source", "currency");
CREATE INDEX "price_latest_updated_at_idx" ON "price_latest"("updated_at" DESC);

CREATE TABLE "price_history_daily" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "card_id" UUID NOT NULL,
  "source" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "market" DOUBLE PRECISION,
  "low" DOUBLE PRECISION,
  "mid" DOUBLE PRECISION,
  "high" DOUBLE PRECISION,
  "direct_low" DOUBLE PRECISION,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "price_history_daily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "price_history_daily_card_id_source_currency_date_key" ON "price_history_daily"("card_id", "source", "currency", "date");
CREATE INDEX "price_history_daily_date_idx" ON "price_history_daily"("date" DESC);

CREATE TABLE "provider_raw_cache" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "provider" TEXT NOT NULL,
  "game_slug" TEXT NOT NULL,
  "resource_type" TEXT NOT NULL,
  "resource_key" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_raw_cache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "provider_raw_cache_provider_game_slug_resource_type_resource_key_key"
  ON "provider_raw_cache"("provider", "game_slug", "resource_type", "resource_key");
CREATE INDEX "provider_raw_cache_game_slug_resource_type_idx" ON "provider_raw_cache"("game_slug", "resource_type");
CREATE INDEX "provider_raw_cache_expires_at_idx" ON "provider_raw_cache"("expires_at");

ALTER TABLE "tcg_sets"
  ADD CONSTRAINT "tcg_sets_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tcg_cards"
  ADD CONSTRAINT "tcg_cards_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tcg_cards"
  ADD CONSTRAINT "tcg_cards_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "tcg_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "price_latest"
  ADD CONSTRAINT "price_latest_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "tcg_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "price_history_daily"
  ADD CONSTRAINT "price_history_daily_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "tcg_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
