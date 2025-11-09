-- CreateTable
CREATE TABLE "IssueMetric" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "pendingCount" INTEGER NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IssueMetric_issueId_key" ON "IssueMetric"("issueId");

-- CreateTable
CREATE TABLE "AdminActionLog" (
    "id" TEXT NOT NULL,
    "issueId" TEXT,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminActionLog_issueId_idx" ON "AdminActionLog"("issueId");

-- AddForeignKey
ALTER TABLE "IssueMetric"
  ADD CONSTRAINT "IssueMetric_issueId_fkey"
  FOREIGN KEY ("issueId") REFERENCES "NewsletterIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminActionLog"
  ADD CONSTRAINT "AdminActionLog_issueId_fkey"
  FOREIGN KEY ("issueId") REFERENCES "NewsletterIssue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
