-- Shared video catalog with subtitle pre-verification and per-video CEFR metadata
DO $$
BEGIN
  CREATE TYPE "VideoSubtitleStatus" AS ENUM ('pending', 'ready', 'missing', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "video_catalog" (
  "id" TEXT NOT NULL,
  "videoId" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'es',
  "sourceType" TEXT NOT NULL DEFAULT 'playlist',
  "sourceId" TEXT NOT NULL,
  "sourceLabel" TEXT,
  "channelId" TEXT NOT NULL,
  "channelTitle" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "thumbnail" TEXT NOT NULL,
  "duration" TEXT NOT NULL DEFAULT '',
  "durationSec" INTEGER,
  "publishedAt" TEXT NOT NULL DEFAULT '',
  "topic" TEXT,
  "level" TEXT,
  "levelSource" TEXT,
  "subtitleStatus" "VideoSubtitleStatus" NOT NULL DEFAULT 'pending',
  "subtitleSource" TEXT,
  "subtitleCueCount" INTEGER,
  "subtitleSampleEs" TEXT,
  "subtitleCheckedAt" TIMESTAMP(3),
  "embeddable" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "video_catalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "video_catalog_videoId_key" ON "video_catalog"("videoId");
CREATE INDEX IF NOT EXISTS "video_catalog_language_subtitleStatus_isActive_idx" ON "video_catalog"("language", "subtitleStatus", "isActive");
CREATE INDEX IF NOT EXISTS "video_catalog_language_level_idx" ON "video_catalog"("language", "level");
CREATE INDEX IF NOT EXISTS "video_catalog_language_channelId_idx" ON "video_catalog"("language", "channelId");
