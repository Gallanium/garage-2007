-- AlterTable: add photo_url column for Telegram user avatars
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "photo_url" TEXT;
