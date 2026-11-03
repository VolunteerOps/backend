CREATE TABLE "user_drafts" (
  "user_id" INTEGER NOT NULL,
  "key" VARCHAR(300) NOT NULL,
  "payload" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_drafts_pkey" PRIMARY KEY ("user_id", "key")
);
CREATE INDEX "user_drafts_user_updated_idx" ON "user_drafts" ("user_id", "updated_at");
ALTER TABLE "user_drafts" ADD CONSTRAINT "user_drafts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
