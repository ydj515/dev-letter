import {
  DeliveryStatus,
  IssueStatus,
  Prisma,
  type IssueDelivery,
  type NewsletterIssue,
  type PrismaClient,
  type Subscriber,
} from "@prisma/client";
import { Resend, type CreateEmailOptions } from "resend";
import { getCategoryLabel } from "../lib/categories";
import { renderDailyNewsletterEmail } from "../lib/email";
import { prisma as defaultPrisma } from "../lib/prisma";
import { getResendClient, getSenderEmail } from "../lib/resend";
import type { QAPair } from "../lib/qa";

type NewsletterDeliveryRepository = Pick<
  PrismaClient,
  "issueDelivery" | "subscriber" | "newsletterIssue"
>;

const DEFAULT_BATCH_SIZE = 40; // Resend batch limit is 50
const DEFAULT_MAX_ATTEMPTS = 3;

export interface SendNewsletterIssueOptions {
  issue: NewsletterIssue;
  prisma?: NewsletterDeliveryRepository;
  batchSize?: number;
  maxAttempts?: number;
  emailClient?: BatchEmailClient;
  baseUrl?: string;
}

export interface SendNewsletterIssueResult {
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
  batches: number;
  requeued: number;
  disabled?: boolean;
  reason?: string;
}

type IssueDeliveryWithSubscriber = IssueDelivery & {
  subscriber: Pick<Subscriber, "id" | "email" | "unsubscribeToken" | "unsubscribedAt">;
};

interface DeliveryBatch {
  attempt: number;
  deliveries: IssueDeliveryWithSubscriber[];
}

export interface BatchEmailClient {
  send(payload: CreateEmailOptions[]): Promise<BatchSendReceipt>;
}

export interface BatchSendReceipt {
  ids: string[];
}

class ResendBatchEmailClient implements BatchEmailClient {
  constructor(private readonly resend: Resend) {}

  async send(payload: CreateEmailOptions[]): Promise<BatchSendReceipt> {
    const response = await this.resend.batch.send(payload);
    if (response.error) {
      throw new Error(response.error.message ?? "Resend batch send failed");
    }
    const ids = response.data?.data?.map((entry) => entry.id) ?? [];
    return { ids };
  }
}

export async function sendNewsletterIssue(
  options: SendNewsletterIssueOptions,
): Promise<SendNewsletterIssueResult> {
  const prisma = options.prisma ?? defaultPrisma;
  const batchSize = clampBatchSize(options.batchSize);
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseUrl = options.baseUrl ?? process.env.APP_BASE_URL;
  const qaPairs = normalizeQaPairs(options.issue.qaPairs);
  const categoryLabel = getCategoryLabel(options.issue.category);

  if (!baseUrl) {
    return disabledResult("APP_BASE_URL is not configured");
  }

  let emailClient = options.emailClient;
  if (!emailClient) {
    try {
      emailClient = new ResendBatchEmailClient(getResendClient());
    } catch (error) {
      return disabledResult(error instanceof Error ? error.message : "Resend unavailable");
    }
  }

  let sender: string;
  try {
    sender = getSenderEmail();
  } catch (error) {
    return disabledResult(error instanceof Error ? error.message : "Missing sender email");
  }

  const summary: SendNewsletterIssueResult = {
    attempted: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    batches: 0,
    requeued: 0,
  };

  const queue: DeliveryBatch[] = [];

  while (true) {
    if (queue.length === 0) {
      const pending = await fetchPendingDeliveries(prisma, options.issue.id, batchSize);
      if (pending.length === 0) {
        break;
      }
      queue.push({ attempt: 1, deliveries: pending });
    }

    const batch = queue.shift();
    if (!batch) break;

    const [skipped, target] = partitionDeliveries(batch.deliveries);

    if (skipped.length > 0) {
      await markUnsubscribed(prisma, skipped);
      summary.skipped += skipped.length;
    }

    if (target.length === 0) {
      continue;
    }

    summary.attempted += target.length;

    try {
      await deliverBatch({
        batch: target,
        sender,
        baseUrl,
        categoryLabel,
        qaPairs,
        issue: options.issue,
        emailClient,
      });
      await markSuccess(prisma, target, options.issue.publishDate);
      summary.sent += target.length;
      summary.batches += 1;
    } catch (error) {
      if (batch.attempt < maxAttempts) {
        queue.push({ deliveries: target, attempt: batch.attempt + 1 });
        summary.requeued += target.length;
        continue;
      }
      await markFailure(prisma, target, error);
      summary.failed += target.length;
    }
  }

  await finalizeIssue(prisma, options.issue.id, summary.sent);
  return summary;
}

async function fetchPendingDeliveries(
  prisma: NewsletterDeliveryRepository,
  issueId: string,
  batchSize: number,
) {
  return prisma.issueDelivery.findMany({
    where: { issueId, status: DeliveryStatus.PENDING },
    include: {
      subscriber: {
        select: {
          id: true,
          email: true,
          unsubscribeToken: true,
          unsubscribedAt: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: batchSize,
  });
}

function partitionDeliveries(deliveries: IssueDeliveryWithSubscriber[]) {
  const skipped: IssueDeliveryWithSubscriber[] = [];
  const target: IssueDeliveryWithSubscriber[] = [];

  for (const delivery of deliveries) {
    if (delivery.subscriber.unsubscribedAt) {
      skipped.push(delivery);
    } else {
      target.push(delivery);
    }
  }

  return [skipped, target] as const;
}

async function markUnsubscribed(
  prisma: NewsletterDeliveryRepository,
  deliveries: IssueDeliveryWithSubscriber[],
) {
  await prisma.issueDelivery.updateMany({
    where: { id: { in: deliveries.map((delivery) => delivery.id) } },
    data: {
      status: DeliveryStatus.FAILED,
      error: "Subscriber unsubscribed",
    },
  });
}

interface DeliverBatchOptions {
  batch: IssueDeliveryWithSubscriber[];
  sender: string;
  baseUrl: string;
  categoryLabel: string;
  qaPairs: QAPair[];
  issue: NewsletterIssue;
  emailClient: BatchEmailClient;
}

async function deliverBatch(options: DeliverBatchOptions) {
  const { batch, sender, baseUrl, categoryLabel, qaPairs, issue, emailClient } = options;
  const ctaUrl = buildCtaUrl(baseUrl);

  const payload = await Promise.all(
    batch.map(async (delivery) => {
      const unsubscribeUrl = buildUnsubscribeUrl(baseUrl, delivery);
      const rendered = await renderDailyNewsletterEmail({
        issueTitle: issue.title,
        categoryLabel,
        publishDate: issue.publishDate,
        qaPairs,
        ctaUrl,
        unsubscribeUrl,
      });

      return {
        from: sender,
        to: delivery.subscriber.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        headers: buildListUnsubscribeHeaders(unsubscribeUrl, sender),
        tags: [
          { name: "issueId", value: issue.id },
          { name: "category", value: issue.category },
        ],
      } satisfies CreateEmailOptions;
    }),
  );

  await emailClient.send(payload);
}

async function markSuccess(
  prisma: NewsletterDeliveryRepository,
  deliveries: IssueDeliveryWithSubscriber[],
  publishDate: Date,
) {
  const sentAt = new Date();
  await prisma.issueDelivery.updateMany({
    where: { id: { in: deliveries.map((delivery) => delivery.id) } },
    data: {
      status: DeliveryStatus.SENT,
      sentAt,
      error: null,
    },
  });

  await prisma.subscriber.updateMany({
    where: { id: { in: deliveries.map((delivery) => delivery.subscriberId) } },
    data: {
      lastSentAt: publishDate,
      unsubscribedAt: null,
    },
  });
}

async function markFailure(
  prisma: NewsletterDeliveryRepository,
  deliveries: IssueDeliveryWithSubscriber[],
  error: unknown,
) {
  const message = error instanceof Error ? error.message : "Unknown delivery failure";
  await prisma.issueDelivery.updateMany({
    where: { id: { in: deliveries.map((delivery) => delivery.id) } },
    data: {
      status: DeliveryStatus.FAILED,
      error: truncate(message, 250),
    },
  });
}

async function finalizeIssue(
  prisma: NewsletterDeliveryRepository,
  issueId: string,
  sentCount: number,
) {
  const pending = await prisma.issueDelivery.count({
    where: { issueId, status: DeliveryStatus.PENDING },
  });
  const status = pending === 0 ? IssueStatus.SENT : IssueStatus.SCHEDULED;

  const data: Prisma.NewsletterIssueUpdateInput = {
    status,
  };

  if (sentCount > 0) {
    data.sentAt = new Date();
  }

  await prisma.newsletterIssue.update({
    where: { id: issueId },
    data,
  });
}

function buildCtaUrl(baseUrl: string) {
  try {
    const url = new URL("/demo", baseUrl);
    url.searchParams.set("utm_source", "dev-letter");
    url.searchParams.set("utm_medium", "email");
    url.searchParams.set("utm_campaign", "daily-newsletter");
    return url.toString();
  } catch {
    return baseUrl;
  }
}

function buildUnsubscribeUrl(baseUrl: string, delivery: IssueDeliveryWithSubscriber) {
  const url = new URL("/api/unsubscribe", baseUrl);
  url.searchParams.set("token", delivery.subscriber.unsubscribeToken ?? "");
  url.searchParams.set("delivery", delivery.id);
  return url.toString();
}

function buildListUnsubscribeHeaders(unsubscribeUrl: string, sender: string) {
  const mailto = `mailto:${sender}?subject=unsubscribe`;
  return {
    "List-Unsubscribe": `<${unsubscribeUrl}>, <${mailto}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  } satisfies Record<string, string>;
}

function truncate(value: string, limit: number) {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit - 1)}…`;
}

function normalizeQaPairs(json: Prisma.JsonValue | null) {
  if (!json || !Array.isArray(json)) {
    return [] as QAPair[];
  }

  return (json as unknown[]).filter(isValidQaPair) as QAPair[];
}

function isValidQaPair(entry: unknown): entry is QAPair {
  if (!entry || typeof entry !== "object") return false;
  const { question, answer } = entry as QAPair;
  return typeof question === "string" && typeof answer === "string";
}

function clampBatchSize(batchSize = DEFAULT_BATCH_SIZE) {
  return Math.max(1, Math.min(batchSize, 50));
}

function disabledResult(reason: string): SendNewsletterIssueResult {
  return {
    attempted: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    batches: 0,
    requeued: 0,
    disabled: true,
    reason,
  };
}
