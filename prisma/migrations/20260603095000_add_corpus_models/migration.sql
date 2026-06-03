-- CORPUS-001: video view history and saved phrases.

CREATE TABLE "video_views" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "videoId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "channelTitle" TEXT NOT NULL,
  "thumbnail" TEXT,
  "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "video_views_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "saved_phrases" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "lemma" TEXT NOT NULL,
  "kind" "LexiconKind" NOT NULL,
  "translationZh" TEXT,
  "explanationZh" TEXT,
  "data" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "saved_phrases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "video_views_userId_videoId_key" ON "video_views"("userId", "videoId");
CREATE INDEX "video_views_userId_viewedAt_idx" ON "video_views"("userId", "viewedAt");

CREATE UNIQUE INDEX "saved_phrases_userId_lemma_kind_key" ON "saved_phrases"("userId", "lemma", "kind");
CREATE INDEX "saved_phrases_userId_createdAt_idx" ON "saved_phrases"("userId", "createdAt");

ALTER TABLE "video_views" ADD CONSTRAINT "video_views_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saved_phrases" ADD CONSTRAINT "saved_phrases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
