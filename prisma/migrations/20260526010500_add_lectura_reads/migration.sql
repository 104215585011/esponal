-- 2026-05-26 01:05 READ-001 lectura read tracking
CREATE TABLE "lectura_reads" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lectura_reads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lectura_reads_userId_slug_key" ON "lectura_reads"("userId", "slug");
CREATE INDEX "lectura_reads_userId_readAt_idx" ON "lectura_reads"("userId", "readAt");

ALTER TABLE "lectura_reads"
ADD CONSTRAINT "lectura_reads_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
