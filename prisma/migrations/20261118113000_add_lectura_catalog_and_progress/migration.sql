-- Shared LecturaCatalog + reading progress & completion tracking on lectura_reads
ALTER TABLE "lectura_reads" ADD COLUMN IF NOT EXISTS "lastParagraphIndex" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "lectura_reads" ADD COLUMN IF NOT EXISTS "totalParagraphs" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "lectura_reads" ADD COLUMN IF NOT EXISTS "completed" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "lectura_reads" ALTER COLUMN "completed" SET DEFAULT false;
ALTER TABLE "lectura_reads" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
ALTER TABLE "lectura_reads" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "lectura_catalog" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'es',
  "contentKind" TEXT NOT NULL DEFAULT 'story',
  "sourceId" TEXT NOT NULL,
  "sourceLabel" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "titleZh" TEXT NOT NULL,
  "summaryZh" TEXT NOT NULL,
  "topic" TEXT NOT NULL DEFAULT '生活文化',
  "level" TEXT,
  "levelSource" TEXT,
  "durationMin" INTEGER NOT NULL DEFAULT 3,
  "paragraphs" JSONB NOT NULL,
  "paragraphCount" INTEGER NOT NULL DEFAULT 0,
  "isFullText" BOOLEAN NOT NULL DEFAULT true,
  "bodyStatus" TEXT NOT NULL DEFAULT 'ready',
  "glossary" JSONB NOT NULL DEFAULT '[]',
  "audioUrl" TEXT,
  "audioType" TEXT NOT NULL DEFAULT 'tts',
  "coverUrl" TEXT,
  "sourceUrl" TEXT,
  "publishedAt" TEXT NOT NULL DEFAULT '',
  "sortWeight" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "lectura_catalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "lectura_catalog_slug_key" ON "lectura_catalog"("slug");
CREATE INDEX IF NOT EXISTS "lectura_catalog_language_bodyStatus_isActive_idx" ON "lectura_catalog"("language", "bodyStatus", "isActive");
CREATE INDEX IF NOT EXISTS "lectura_catalog_language_contentKind_level_idx" ON "lectura_catalog"("language", "contentKind", "level");
