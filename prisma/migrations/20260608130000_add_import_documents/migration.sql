CREATE TYPE "ImportKind" AS ENUM ('epub', 'pdf_text', 'pdf_ocr');
CREATE TYPE "ImportStatus" AS ENUM ('processing', 'ready', 'failed');

CREATE TABLE "ImportedDocument" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "kind" "ImportKind" NOT NULL,
  "status" "ImportStatus" NOT NULL DEFAULT 'processing',
  "pageCount" INTEGER NOT NULL DEFAULT 0,
  "lastPageIndex" INTEGER NOT NULL DEFAULT 0,
  "failReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ImportedDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImportedDocument_userId_createdAt_idx" ON "ImportedDocument"("userId", "createdAt");

ALTER TABLE "ImportedDocument"
ADD CONSTRAINT "ImportedDocument_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DocumentSection" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "pageIndex" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DocumentSection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentSection_documentId_pageIndex_key" ON "DocumentSection"("documentId", "pageIndex");
CREATE INDEX "DocumentSection_documentId_pageIndex_idx" ON "DocumentSection"("documentId", "pageIndex");

ALTER TABLE "DocumentSection"
ADD CONSTRAINT "DocumentSection_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "ImportedDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
