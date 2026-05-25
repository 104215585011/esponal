ALTER TABLE "ChatSession"
ADD COLUMN "archived_at" TIMESTAMP(3);

CREATE INDEX "ChatSession_status_archived_at_idx"
ON "ChatSession"("status", "archived_at");
