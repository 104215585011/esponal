-- Multi-language isolation: add language discriminator + composite unique indexes

DROP INDEX IF EXISTS "LexiconEntry_kind_lemma_key";
DROP INDEX IF EXISTS "Word_userId_lemma_key";
DROP INDEX IF EXISTS "saved_phrases_userId_lemma_kind_key";

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "activeLanguage" TEXT NOT NULL DEFAULT 'es';
ALTER TABLE "Word" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'es';
ALTER TABLE "LexiconEntry" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'es';
ALTER TABLE "saved_phrases" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'es';
ALTER TABLE "lectura_reads" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'es';
ALTER TABLE "video_views" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'es';
ALTER TABLE "ImportedDocument" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'es';

CREATE INDEX IF NOT EXISTS "ImportedDocument_userId_language_createdAt_idx" ON "ImportedDocument"("userId", "language", "createdAt");
CREATE INDEX IF NOT EXISTS "LexiconEntry_language_idx" ON "LexiconEntry"("language");
CREATE UNIQUE INDEX IF NOT EXISTS "LexiconEntry_language_kind_lemma_key" ON "LexiconEntry"("language", "kind", "lemma");
CREATE INDEX IF NOT EXISTS "Word_userId_language_idx" ON "Word"("userId", "language");
CREATE INDEX IF NOT EXISTS "Word_userId_language_srsDue_idx" ON "Word"("userId", "language", "srsDue");
CREATE UNIQUE INDEX IF NOT EXISTS "Word_userId_language_lemma_key" ON "Word"("userId", "language", "lemma");
CREATE INDEX IF NOT EXISTS "lectura_reads_userId_language_readAt_idx" ON "lectura_reads"("userId", "language", "readAt");
CREATE INDEX IF NOT EXISTS "saved_phrases_userId_language_createdAt_idx" ON "saved_phrases"("userId", "language", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "saved_phrases_userId_language_lemma_kind_key" ON "saved_phrases"("userId", "language", "lemma", "kind");
CREATE INDEX IF NOT EXISTS "video_views_userId_language_viewedAt_idx" ON "video_views"("userId", "language", "viewedAt");
