-- CreateEnum
CREATE TYPE "LexiconKind" AS ENUM ('word', 'phrase', 'collocation', 'idiom');

-- CreateEnum
CREATE TYPE "CefrLevel" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');

-- CreateTable
CREATE TABLE "LexiconEntry" (
    "id" TEXT NOT NULL,
    "kind" "LexiconKind" NOT NULL,
    "lemma" TEXT NOT NULL,
    "displayForm" TEXT NOT NULL,
    "forms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "partOfSpeech" TEXT,
    "level" "CefrLevel",
    "frequency" INTEGER,
    "ipa" TEXT,
    "audioUrl" TEXT,
    "translationZh" TEXT,
    "translationEn" TEXT,
    "explanationZh" TEXT,
    "examples" JSONB,
    "morphology" JSONB,
    "collocations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "sources" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "licenseCode" TEXT NOT NULL,
    "qualityScore" INTEGER NOT NULL DEFAULT 0,
    "lookupCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LexiconEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LexiconEntry_kind_lemma_key" ON "LexiconEntry"("kind", "lemma");

-- CreateIndex
CREATE INDEX "LexiconEntry_level_idx" ON "LexiconEntry"("level");

-- CreateIndex
CREATE INDEX "LexiconEntry_frequency_idx" ON "LexiconEntry"("frequency");

-- CreateIndex
CREATE INDEX "LexiconEntry_lookupCount_idx" ON "LexiconEntry"("lookupCount");
