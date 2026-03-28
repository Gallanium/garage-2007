-- AlterTable: add claimed_league_tiers column for league one-time rewards
ALTER TABLE "game_saves" ADD COLUMN IF NOT EXISTS "claimed_league_tiers" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- CreateIndex: descending index on total_earned for leaderboard queries
CREATE INDEX IF NOT EXISTS "game_saves_total_earned_idx" ON "game_saves"("total_earned" DESC);
