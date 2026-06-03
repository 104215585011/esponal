-- LEX-007: layer the lexicon into vault / candidate / review / rejected.

CREATE TYPE "LexiconStatus" AS ENUM ('vault', 'candidate', 'review', 'rejected');

ALTER TABLE "LexiconEntry" ADD COLUMN "status" "LexiconStatus" NOT NULL DEFAULT 'vault';

-- Existing naive AI backfills (licenseCode = 'external-lookup') are AI-mined,
-- not license-clean seed data: move them out of the vault into the candidate layer.
UPDATE "LexiconEntry" SET "status" = 'candidate' WHERE "licenseCode" = 'external-lookup';

CREATE INDEX "LexiconEntry_status_idx" ON "LexiconEntry"("status");
