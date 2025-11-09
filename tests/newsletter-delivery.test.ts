import assert from "node:assert/strict";
import test from "node:test";
import {
  DeliveryStatus,
  InterestCategory,
  IssueStatus,
  type IssueDelivery,
  type NewsletterIssue,
  type Subscriber,
} from "@prisma/client";
import { sendNewsletterIssue, type BatchEmailClient } from "../src/services/newsletter-delivery";

type IssueDeliveryRecord = IssueDelivery & { subscriber: Subscriber };

class MemoryPrisma {
  issue: NewsletterIssue;
  deliveries: IssueDeliveryRecord[];
  subscribers: Subscriber[];

  constructor(
    issue: NewsletterIssue,
    deliveries: IssueDeliveryRecord[],
    subscribers: Subscriber[],
  ) {
    this.issue = issue;
    this.deliveries = deliveries;
    this.subscribers = subscribers;
  }

  issueDelivery = {
    findMany: async (args: any) => {
      const where = args?.where ?? {};
      const take = args?.take as number | undefined;
      const filtered = this.deliveries
        .filter(
          (delivery) =>
            (!where.issueId || delivery.issueId === where.issueId) &&
            (!where.status || delivery.status === where.status),
        )
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      return filtered.slice(0, take ?? filtered.length);
    },
    updateMany: async (args: any) => {
      const ids: string[] = args?.where?.id?.in ?? [];
      let count = 0;
      for (const delivery of this.deliveries) {
        if (ids.includes(delivery.id)) {
          Object.assign(delivery, args.data);
          count += 1;
        }
      }
      return { count };
    },
    count: async (args: any) => {
      const where = args?.where ?? {};
      return this.deliveries.filter(
        (delivery) =>
          (!where.issueId || delivery.issueId === where.issueId) &&
          (!where.status || delivery.status === where.status),
      ).length;
    },
  };

  subscriber = {
    updateMany: async (args: any) => {
      const ids: string[] = args?.where?.id?.in ?? [];
      let count = 0;
      for (const subscriber of this.subscribers) {
        if (ids.includes(subscriber.id)) {
          Object.assign(subscriber, args.data);
          count += 1;
        }
      }
      return { count };
    },
  };

  newsletterIssue = {
    update: async (args: any) => {
      if (this.issue.id === args?.where?.id) {
        this.issue = { ...this.issue, ...args.data } as NewsletterIssue;
      }
      return this.issue;
    },
  };
}

class StubEmailClient implements BatchEmailClient {
  public attempts = 0;
  constructor(private readonly failUntilAttempt = 0) {}

  async send(): Promise<{ ids: string[] }> {
    this.attempts += 1;
    if (this.attempts <= this.failUntilAttempt) {
      throw new Error("SMTP unavailable");
    }
    return { ids: [] };
  }
}

function buildIssue(overrides: Partial<NewsletterIssue> = {}): NewsletterIssue {
  const now = new Date("2025-01-10T00:00:00Z");
  return {
    id: overrides.id ?? "issue_test",
    category: overrides.category ?? InterestCategory.Backend,
    title: overrides.title ?? "Dev Letter Daily • Backend",
    qaPairs: overrides.qaPairs ?? [
      {
        question: "최근 Backend 트래픽 급증에 어떻게 대응했나요?",
        answer: "세션 캐시 분리와 슬로우 쿼리 튜닝으로 35% 이상의 여유 용량을 확보했습니다.",
      },
    ],
    generatedAt: overrides.generatedAt ?? now,
    publishDate: overrides.publishDate ?? now,
    scheduledFor: overrides.scheduledFor ?? now,
    sentAt: overrides.sentAt ?? null,
    status: overrides.status ?? IssueStatus.SCHEDULED,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

function buildSubscriber(overrides: Partial<Subscriber> = {}): Subscriber {
  return {
    id: overrides.id ?? `sub_${Math.random().toString(16).slice(2)}`,
    email: overrides.email ?? "dev@example.com",
    interests: overrides.interests ?? ["Backend"],
    createdAt: overrides.createdAt ?? new Date("2025-01-01T00:00:00Z"),
    lastSentAt: overrides.lastSentAt ?? null,
    preferredSendTime: overrides.preferredSendTime ?? null,
    unsubscribedAt: overrides.unsubscribedAt ?? null,
    unsubscribeToken: overrides.unsubscribeToken ?? `tok_${Math.random().toString(16).slice(2)}`,
  };
}

function buildDelivery(
  overrides: Partial<IssueDeliveryRecord> & { subscriber: Subscriber },
): IssueDeliveryRecord {
  const createdAt = overrides.createdAt ?? new Date("2025-01-10T00:00:00Z");
  return {
    id: overrides.id ?? `delivery_${Math.random().toString(16).slice(2)}`,
    issueId: overrides.issueId ?? "issue_test",
    subscriberId: overrides.subscriberId ?? overrides.subscriber.id,
    status: overrides.status ?? DeliveryStatus.PENDING,
    error: overrides.error ?? null,
    sentAt: overrides.sentAt ?? null,
    createdAt,
    subscriber: overrides.subscriber,
  } as IssueDeliveryRecord;
}

function setupMemoryPrisma(options: {
  issue?: NewsletterIssue;
  deliveries: IssueDeliveryRecord[];
  subscribers: Subscriber[];
}) {
  const issue = options.issue ?? buildIssue();
  return new MemoryPrisma(issue, options.deliveries, options.subscribers);
}

function toRepo(prisma: MemoryPrisma) {
  return prisma as unknown as Parameters<typeof sendNewsletterIssue>[0]["prisma"];
}

const originalBaseUrl = process.env.APP_BASE_URL;
const originalSender = process.env.RESEND_FROM_EMAIL;
process.env.APP_BASE_URL = "https://dev-letter.dev";
process.env.RESEND_FROM_EMAIL = "Dev Letter <news@dev-letter.dev>";

test("sends pending deliveries and marks success", async () => {
  const subscriber = buildSubscriber({ email: "success@example.com" });
  const delivery = buildDelivery({ subscriber });
  const prisma = setupMemoryPrisma({ deliveries: [delivery], subscribers: [subscriber] });
  const emailClient = new StubEmailClient();

  const result = await sendNewsletterIssue({
    issue: prisma.issue,
    prisma: toRepo(prisma),
    emailClient,
  });

  assert.equal(result.sent, 1);
  assert.equal(result.failed, 0);
  assert.equal(prisma.deliveries[0].status, DeliveryStatus.SENT);
  assert.equal(
    prisma.subscribers[0].lastSentAt?.toISOString(),
    prisma.issue.publishDate.toISOString(),
  );
});

test("retries before marking deliveries as failed", async () => {
  const subscriber = buildSubscriber({ email: "fail@example.com" });
  const delivery = buildDelivery({ subscriber });
  const prisma = setupMemoryPrisma({ deliveries: [delivery], subscribers: [subscriber] });
  const emailClient = new StubEmailClient(2);

  const result = await sendNewsletterIssue({
    issue: prisma.issue,
    prisma: toRepo(prisma),
    emailClient,
    maxAttempts: 2,
  });

  assert.equal(result.sent, 0);
  assert.equal(result.failed, 1);
  assert.equal(result.requeued, 1);
  assert.equal(prisma.deliveries[0].status, DeliveryStatus.FAILED);
});

test("skips recipients who already unsubscribed", async () => {
  const subscriber = buildSubscriber({
    email: "skip@example.com",
    unsubscribedAt: new Date("2025-01-05T00:00:00Z"),
  });
  const delivery = buildDelivery({ subscriber });
  const prisma = setupMemoryPrisma({ deliveries: [delivery], subscribers: [subscriber] });
  const emailClient = new StubEmailClient();

  const result = await sendNewsletterIssue({
    issue: prisma.issue,
    prisma: toRepo(prisma),
    emailClient,
  });

  assert.equal(result.skipped, 1);
  assert.equal(result.sent, 0);
  assert.equal(prisma.deliveries[0].status, DeliveryStatus.FAILED);
});

process.on("exit", () => {
  restoreEnv("APP_BASE_URL", originalBaseUrl);
  restoreEnv("RESEND_FROM_EMAIL", originalSender);
});

function restoreEnv(key: string, value: string | undefined) {
  if (typeof value === "undefined") {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
