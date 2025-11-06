-- CreateEnum
CREATE TYPE "InterestCategory" AS ENUM ('Backend', 'Database', 'Network', 'Java', 'Spring', 'DevOps', 'Frontend', 'AI/ML');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENT');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "Subscriber"
  ADD COLUMN "lastSentAt" TIMESTAMP(3),
  ADD COLUMN "preferredSendTime" TEXT;

-- CreateTable
CREATE TABLE "NewsletterIssue" (
    "id" TEXT NOT NULL,
    "category" "InterestCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "questions" TEXT[] NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "status" "IssueStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterIssue_category_publishDate_key" ON "NewsletterIssue"("category", "publishDate");

-- CreateTable
CREATE TABLE "IssueDelivery" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IssueDelivery_issueId_idx" ON "IssueDelivery"("issueId");

-- CreateIndex
CREATE INDEX "IssueDelivery_subscriberId_idx" ON "IssueDelivery"("subscriberId");

-- CreateIndex
CREATE UNIQUE INDEX "IssueDelivery_issueId_subscriberId_key" ON "IssueDelivery"("issueId", "subscriberId");

-- AddForeignKey
ALTER TABLE "IssueDelivery"
  ADD CONSTRAINT "IssueDelivery_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "NewsletterIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueDelivery"
  ADD CONSTRAINT "IssueDelivery_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
