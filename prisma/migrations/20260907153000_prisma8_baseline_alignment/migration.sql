-- Align the live PostgreSQL schema with the emitted Prisma 8 contract before
-- transferring migration ownership. Keep Prisma 7's migration ledger intact.
BEGIN;

ALTER TABLE "events"
  ALTER COLUMN "tags" SET NOT NULL,
  ALTER COLUMN "tags" SET DEFAULT '{}';

-- Reuse the existing unique index instead of dropping and rebuilding it.
ALTER TABLE "volunteers"
  ADD CONSTRAINT "volunteers_user_id_key"
  UNIQUE USING INDEX "volunteers_user_id_key";

COMMIT;
