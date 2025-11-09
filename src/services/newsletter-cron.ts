import {
  DeliveryStatus,
  InterestCategory,
  IssueStatus,
  type NewsletterIssue,
  type PrismaClient,
} from "@prisma/client";
import { geminiClient, type AiClient } from "../lib/ai";
import { getCategoryLabel } from "../lib/categories";
import { getDailyCategorySchedule, type DailyCategorySchedule } from "../lib/category-rotation";
import { prisma as defaultPrisma } from "../lib/prisma";
import { startOfDay } from "../lib/utils";
import { createNewsletterIssue, type IssueCreationSource } from "./newsletter-issue";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_BACKLOG_WINDOW_DAYS = 3;

export interface RunNewsletterCronOptions {
  date?: Date;
  prisma?: PrismaClient;
  aiClient?: AiClient;
  cycleStartDate?: Date;
  backlogWindowDays?: number;
}

export interface NewsletterCronResult {
  schedule: SerializableSchedule;
  issue: {
    id: string;
    category: InterestCategory;
    publishDate: string;
    status: IssueStatus;
    source: IssueCreationSource;
  };
  deliveries: DeliverySummary;
  backlog: BacklogSummary;
}

interface SerializableSchedule {
  label: string;
  category: InterestCategory;
  publishDate: string;
  rotationIndex: number;
  cycleStartDate: string;
  offsetDays: number;
}

interface DeliverySummary {
  subscribersMatched: number;
  deliveriesCreated: number;
  alreadyQueued: number;
}

interface BacklogSummary {
  inspected: number;
  requeued: number;
  issues: BacklogIssueSummary[];
}

interface BacklogIssueSummary {
  id: string;
  category: InterestCategory;
  publishDate: string;
  deliveriesCreated: number;
  subscribersMatched: number;
}

export async function runNewsletterCron(
  options: RunNewsletterCronOptions = {},
): Promise<NewsletterCronResult> {
  const prisma = options.prisma ?? defaultPrisma;
  const aiClient = options.aiClient ?? geminiClient;
  const schedule = getDailyCategorySchedule(options.date, {
    cycleStartDate: options.cycleStartDate,
  });
  const backlogWindowDays = options.backlogWindowDays ?? DEFAULT_BACKLOG_WINDOW_DAYS;
  const scheduledAt = new Date();

  const backlog = await processBacklogIssues(prisma, schedule.publishDate, scheduledAt, backlogWindowDays);

  const { issue, source } = await createNewsletterIssue({
    category: schedule.category,
    publishDate: schedule.publishDate,
    prisma,
    aiClient,
  });

  const queueSummary = await ensureDeliveriesForIssue(prisma, issue, schedule.label, scheduledAt);

  return {
    schedule: serializeSchedule(schedule),
    issue: {
      id: issue.id,
      category: issue.category,
      publishDate: issue.publishDate.toISOString(),
      status: IssueStatus.SCHEDULED,
      source,
    },
    deliveries: queueSummary,
    backlog,
  };
}

async function processBacklogIssues(
  prisma: PrismaClient,
  publishDate: Date,
  scheduledAt: Date,
  backlogWindowDays: number,
): Promise<BacklogSummary> {
  if (backlogWindowDays <= 0) {
    return { inspected: 0, requeued: 0, issues: [] };
  }

  const windowStart = new Date(startOfDay(publishDate).getTime() - backlogWindowDays * MS_PER_DAY);
  const backlogIssues = await prisma.newsletterIssue.findMany({
    where: {
      publishDate: { lt: publishDate, gte: windowStart },
      status: { in: [IssueStatus.DRAFT, IssueStatus.SCHEDULED] },
    },
    orderBy: { publishDate: "asc" },
  });

  const summaries: BacklogIssueSummary[] = [];

  for (const issue of backlogIssues) {
    const label = getCategoryLabel(issue.category);
    const queueResult = await ensureDeliveriesForIssue(prisma, issue, label, scheduledAt);

    summaries.push({
      id: issue.id,
      category: issue.category,
      publishDate: issue.publishDate.toISOString(),
      deliveriesCreated: queueResult.deliveriesCreated,
      subscribersMatched: queueResult.subscribersMatched,
    });
  }

  return {
    inspected: backlogIssues.length,
    requeued: summaries.filter((summary) => summary.deliveriesCreated > 0).length,
    issues: summaries,
  };
}

async function ensureDeliveriesForIssue(
  prisma: PrismaClient,
  issue: NewsletterIssue,
  categoryLabel: string,
  scheduledAt: Date,
): Promise<DeliverySummary> {
  const eligibleSubscribers = await prisma.subscriber.findMany({
    where: {
      interests: { has: categoryLabel },
      OR: [{ lastSentAt: null }, { lastSentAt: { lt: issue.publishDate } }],
    },
    select: { id: true },
  });

  let deliveriesCreated = 0;

  if (eligibleSubscribers.length > 0) {
    deliveriesCreated = await createDeliveries(prisma, issue.id, eligibleSubscribers);
  }

  await prisma.newsletterIssue.update({
    where: { id: issue.id },
    data: {
      status: IssueStatus.SCHEDULED,
      scheduledFor: scheduledAt,
    },
  });

  return {
    subscribersMatched: eligibleSubscribers.length,
    deliveriesCreated,
    alreadyQueued: Math.max(eligibleSubscribers.length - deliveriesCreated, 0),
  };
}

async function createDeliveries(
  prisma: PrismaClient,
  issueId: string,
  subscribers: Array<{ id: string }>,
) {
  const payload = subscribers.map((subscriber) => ({
    issueId,
    subscriberId: subscriber.id,
    status: DeliveryStatus.PENDING,
  }));

  const result = await prisma.issueDelivery.createMany({
    data: payload,
    skipDuplicates: true,
  });

  return result.count;
}

function serializeSchedule(schedule: DailyCategorySchedule): SerializableSchedule {
  return {
    label: schedule.label,
    category: schedule.category,
    publishDate: schedule.publishDate.toISOString(),
    rotationIndex: schedule.rotationIndex,
    cycleStartDate: schedule.cycleStartDate.toISOString(),
    offsetDays: schedule.offsetDays,
  };
}
