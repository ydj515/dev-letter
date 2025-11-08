# Phase 1 — Data Model & Migration

## Prisma schema changes

```prisma
enum InterestCategory {
  Backend
  Database
  Network
  Java
  Spring
  DevOps
  Frontend
  AI_ML @map("AI/ML")
}

enum IssueStatus {
  DRAFT
  SCHEDULED
  SENT
}

enum DeliveryStatus {
  PENDING
  SENT
  FAILED
}
```

### NewsletterIssue

Represents a generated/scheduled newsletter entry for a specific category and day.

- `category` uses `InterestCategory` enum to keep parity with `INTEREST_CATEGORIES`.
- `publishDate` stores the logical issue date (start-of-day) and is unique per category to prevent duplicate daily issues.
- `qaPairs` keeps the rendered AI 질문+답변 JSON 배열.
- `status`, `scheduledFor`, `sentAt` enable scheduling state tracking.

### IssueDelivery

Tracks the delivery lifecycle per subscriber.

- Composite unique key (`issueId`, `subscriberId`) allows idempotent upserts.
- `status` transitions `PENDING → SENT/FAILED`; `error` captures Resend failures.
- Foreign keys cascade on delete to keep the log tidy.

### Subscriber (extended)

- `lastSentAt` records the most recent issue timestamp delivered to the subscriber.
- `preferredSendTime` (HH:mm 형식 예상) enables per-user scheduling in later phases.
- `deliveries` relation wires to `IssueDelivery`.

## Migration

- Added SQL migration `20250801120000_phase1_newsletter`.
- Added follow-up migration `20250204103000_phase2_qa_pairs` to backfill `qaPairs` and drop the legacy `questions` column.
- Apply with `npx prisma migrate deploy` (CI) or `npx prisma migrate dev --name phase2_qa_pairs`.

## Seed script

```
npm run seed:newsletter
```

- Generates one `NewsletterIssue` per category for the current day (draft 상태) with 기본 QA 세트.
- Creates `IssueDelivery` stubs for subscribers whose `interests` contain the category.
- Updates `lastSentAt` when a subscriber is associated for the first time.

> Tip: Run `npm run analyze:subs` beforehand to ensure interest data is clean. Seed assumes 값이 `INTEREST_CATEGORIES`와 일치합니다.
