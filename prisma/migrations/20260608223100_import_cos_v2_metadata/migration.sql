ALTER TABLE "ImportedDocument"
ADD COLUMN IF NOT EXISTS "ossKey" TEXT,
ADD COLUMN IF NOT EXISTS "sizeBytes" INTEGER,
ADD COLUMN IF NOT EXISTS "unitCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "lastPosition" TEXT NOT NULL DEFAULT '';

UPDATE "ImportedDocument"
SET "kind" = 'pdf'
WHERE "kind"::text IN ('pdf_text', 'pdf_ocr');

UPDATE "ImportedDocument"
SET "status" = 'failed',
    "failReason" = COALESCE("failReason", 'legacy_import_replaced_by_cos_v2')
WHERE "status"::text = 'processing';

UPDATE "ImportedDocument"
SET "ossKey" = COALESCE("ossKey", 'legacy-missing-object/' || "id"),
    "sizeBytes" = COALESCE("sizeBytes", 0);

ALTER TABLE "ImportedDocument"
ALTER COLUMN "ossKey" SET NOT NULL,
ALTER COLUMN "sizeBytes" SET NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'ready';
