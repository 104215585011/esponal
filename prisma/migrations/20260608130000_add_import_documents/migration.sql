CREATE TYPE "ImportKind" AS ENUM ('epub', 'pdf');
CREATE TYPE "ImportStatus" AS ENUM ('ready', 'failed');

CREATE TABLE "ImportedDocument" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "kind" "ImportKind" NOT NULL,
  "ossKey" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "unitCount" INTEGER NOT NULL DEFAULT 0,
  "lastPosition" TEXT NOT NULL DEFAULT '',
  "status" "ImportStatus" NOT NULL DEFAULT 'ready',
  "failReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ImportedDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImportedDocument_userId_createdAt_idx" ON "ImportedDocument"("userId", "createdAt");

ALTER TABLE "ImportedDocument"
ADD CONSTRAINT "ImportedDocument_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
