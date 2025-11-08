ALTER TABLE "NewsletterIssue"
  ADD COLUMN "qaPairs" JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE "NewsletterIssue"
SET "qaPairs" = COALESCE(
  (
    SELECT jsonb_agg(jsonb_build_object('question', q, 'answer', ''))
    FROM unnest("questions") AS q
  ),
  '[]'::jsonb
);

ALTER TABLE "NewsletterIssue"
  DROP COLUMN "questions";
