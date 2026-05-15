-- VOCAB-004 change timestamp: 2026-05-15 18:50
ALTER TABLE "Word" ADD COLUMN "dictData" JSONB;
ALTER TABLE "Word" ADD COLUMN "partOfSpeech" TEXT;

ALTER TABLE "WordEncounter" ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'video';
ALTER TABLE "WordEncounter" ADD COLUMN "courseRef" TEXT;
