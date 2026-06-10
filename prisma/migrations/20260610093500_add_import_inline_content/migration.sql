ALTER TABLE "ImportedDocument"
ADD COLUMN IF NOT EXISTS "inlineContent" BYTEA;
