-- Prisma 8 serializes Numeric defaults as decimal strings. Keep the same
-- effective default while making its PostgreSQL catalog form unambiguous.
ALTER TABLE "volunteers"
  ALTER COLUMN "total_hours" SET DEFAULT '0'::numeric(10, 2);
