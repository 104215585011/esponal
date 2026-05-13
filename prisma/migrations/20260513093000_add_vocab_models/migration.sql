-- CreateEnum
CREATE TYPE "WordStatus" AS ENUM ('NEW', 'LEARNING', 'KNOWN');

-- CreateTable
CREATE TABLE "Word" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lemma" TEXT NOT NULL,
    "translation" TEXT NOT NULL,
    "forms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "WordStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Word_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WordEncounter" (
    "id" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "timestampSec" INTEGER NOT NULL,
    "originalSentence" TEXT NOT NULL,
    "translatedSentence" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WordEncounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Word_userId_idx" ON "Word"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Word_userId_lemma_key" ON "Word"("userId", "lemma");

-- CreateIndex
CREATE INDEX "WordEncounter_wordId_idx" ON "WordEncounter"("wordId");

-- AddForeignKey
ALTER TABLE "Word" ADD CONSTRAINT "Word_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordEncounter" ADD CONSTRAINT "WordEncounter_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE CASCADE ON UPDATE CASCADE;
