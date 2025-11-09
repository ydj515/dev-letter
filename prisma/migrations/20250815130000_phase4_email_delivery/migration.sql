-- Add unsubscribe tracking columns
ALTER TABLE "Subscriber"
  ADD COLUMN IF NOT EXISTS "unsubscribedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "unsubscribeToken" TEXT;

-- Backfill tokens for existing subscribers
UPDATE "Subscriber"
SET "unsubscribeToken" = substr(md5(random()::text || clock_timestamp()::text), 1, 24)
WHERE "unsubscribeToken" IS NULL;

-- Enforce constraints
ALTER TABLE "Subscriber"
  ALTER COLUMN "unsubscribeToken" SET NOT NULL,
  ALTER COLUMN "unsubscribeToken" SET DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 24);

CREATE UNIQUE INDEX IF NOT EXISTS "Subscriber_unsubscribeToken_key"
  ON "Subscriber"("unsubscribeToken");
