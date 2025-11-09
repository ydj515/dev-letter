import {
  DeliveryStatus,
  InterestCategory,
  IssueStatus,
  type NewsletterIssue,
  type PrismaClient,
} from "@prisma/client";
import pLimit from "p-limit";
import { geminiClient, type AiClient } from "../lib/ai";
import { getCategoryLabel } from "../lib/categories";
import { getDailyCategorySchedule, type DailyCategorySchedule } from "../lib/category-rotation";
import { prisma as defaultPrisma } from "../lib/prisma";
import { startOfDay } from "../lib/utils";
import { createNewsletterIssue, type IssueCreationSource } from "./newsletter-issue";
import {
  sendNewsletterIssue,
  type BatchEmailClient,
  type SendNewsletterIssueResult,
} from "./newsletter-delivery";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_BACKLOG_WINDOW_DAYS = 3;
const BACKLOG_CONCURRENCY = 4;

export interface RunNewsletterCronOptions {
  date?: Date;
  prisma?: PrismaClient;
  aiClient?: AiClient;
  cycleStartDate?: Date;
  backlogWindowDays?: number;
  delivery?: DeliveryOptions;
}

interface DeliveryOptions {
  batchSize?: number;
  maxAttempts?: number;
  baseUrl?: string;
  emailClient?: BatchEmailClient;
}

export interface NewsletterCronResult {
  schedule: SerializableSchedule;
  issue: {
    id: string;
    category: InterestCategory;
    publishDate: string;
    status: IssueStatus;
    sentAt: string | null;
    source: IssueCreationSource;
  };
  deliveries: DeliverySummary;
  send: SendNewsletterIssueResult;
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
  send: SendNewsletterIssueResult;
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

  const backlog = await processBacklogIssues(
    prisma,
    schedule.publishDate,
    scheduledAt,
    backlogWindowDays,
    options.delivery,
  );

  const { issue, source } = await createNewsletterIssue({
    category: schedule.category,
    publishDate: schedule.publishDate,
    prisma,
    aiClient,
  });

  const queueSummary = await ensureDeliveriesForIssue(prisma, issue, schedule.label, scheduledAt);
  const sendSummary = await sendNewsletterIssue({
    issue,
    prisma,
    batchSize: options.delivery?.batchSize,
    maxAttempts: options.delivery?.maxAttempts,
    baseUrl: options.delivery?.baseUrl,
    emailClient: options.delivery?.emailClient,
  });
  const latestIssue = await prisma.newsletterIssue.findUnique({
    where: { id: issue.id },
    select: { status: true, sentAt: true },
  });

  return {
    schedule: serializeSchedule(schedule),
    issue: {
      id: issue.id,
      category: issue.category,
      publishDate: issue.publishDate.toISOString(),
      status: latestIssue?.status ?? IssueStatus.SCHEDULED,
      sentAt: latestIssue?.sentAt?.toISOString() ?? null,
      source,
    },
    deliveries: queueSummary,
    send: sendSummary,
    backlog,
  };
}

async function processBacklogIssues(
  prisma: PrismaClient,
  publishDate: Date,
  scheduledAt: Date,
  backlogWindowDays: number,
  deliveryOptions?: DeliveryOptions,
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

  const limit = pLimit(BACKLOG_CONCURRENCY);
  const summaries = await Promise.all(
    backlogIssues.map((issue) =>
      limit(async () => {
        const label = getCategoryLabel(issue.category);
        const queueResult = await ensureDeliveriesForIssue(prisma, issue, label, scheduledAt);
        const sendResult = await sendNewsletterIssue({
          issue,
          prisma,
          batchSize: deliveryOptions?.batchSize,
          maxAttempts: deliveryOptions?.maxAttempts,
          baseUrl: deliveryOptions?.baseUrl,
          emailClient: deliveryOptions?.emailClient,
        });

        return {
          id: issue.id,
          category: issue.category,
          publishDate: issue.publishDate.toISOString(),
          deliveriesCreated: queueResult.deliveriesCreated,
          subscribersMatched: queueResult.subscribersMatched,
          send: sendResult,
        };
      }),
    ),
  );

  return {
    inspected: backlogIssues.length,
    requeued: summaries.filter((summary) => summary.deliveriesCreated > 0).length,
    issues: summaries,
  };
}

export async function ensureDeliveriesForIssue(
  prisma: PrismaClient,
  issue: NewsletterIssue,
  categoryLabel: string,
  scheduledAt: Date,
): Promise<DeliverySummary> {
  const eligibleSubscribers = await prisma.subscriber.findMany({
    where: {
      interests: { has: categoryLabel },
      unsubscribedAt: null,
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
