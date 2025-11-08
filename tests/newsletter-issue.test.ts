import assert from "node:assert/strict";
import test from "node:test";
import {
  InterestCategory,
  IssueStatus,
  type NewsletterIssue,
  type PrismaClient,
} from "@prisma/client";
import { createNewsletterIssue } from "../src/services/newsletter-issue";
import type { AiClient } from "../src/lib/ai";
import type { QAPair } from "../src/lib/qa";

class SuccessAiClient implements AiClient {
  constructor(private readonly payload: string) {}

  async generateText() {
    return { text: this.payload };
  }
}

class FailingAiClient implements AiClient {
  async generateText(): Promise<never> {
    throw new Error("Gemini unavailable");
  }
}

interface PrismaDouble {
  newsletterIssue: {
    findUnique: (args: unknown) => Promise<NewsletterIssue | null>;
    create: (args: { data: Partial<NewsletterIssue> }) => Promise<NewsletterIssue>;
  };
  createCount: number;
}

function buildIssue(overrides: Partial<NewsletterIssue>): NewsletterIssue {
  const now = overrides.createdAt ?? new Date();
  return {
    id: overrides.id ?? "issue_existing",
    category: overrides.category ?? InterestCategory.Backend,
    title: overrides.title ?? "Dev Letter Daily",
    qaPairs: overrides.qaPairs ?? [],
    generatedAt: overrides.generatedAt ?? now,
    publishDate: overrides.publishDate ?? now,
    scheduledFor: overrides.scheduledFor ?? now,
    sentAt: overrides.sentAt ?? null,
    status: overrides.status ?? IssueStatus.DRAFT,
    createdAt: now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

function createPrismaDouble(existing: NewsletterIssue | null = null): PrismaDouble {
  let stored = existing;
  const prisma: PrismaDouble = {
    newsletterIssue: {
      async findUnique() {
        return stored;
      },
      async create({ data }) {
        prisma.createCount += 1;
        const now = new Date();
        stored = buildIssue({
          ...(data as NewsletterIssue),
          id: `issue_${prisma.createCount}`,
          createdAt: now,
          updatedAt: now,
          generatedAt: data.generatedAt ?? now,
          publishDate: data.publishDate ?? now,
          scheduledFor: data.scheduledFor ?? now,
          status: data.status ?? IssueStatus.DRAFT,
        });
        return stored;
      },
    },
    createCount: 0,
  };

  return prisma;
}

test("creates a newsletter issue with AI generated questions", async () => {
  const aiPayload = JSON.stringify(
    Array.from({ length: 5 }).map((_, index) => ({
      question: `Backend 대규모 트래픽 ${index + 1}번째 급증 시 어떤 완화 전략을 선택했나요?`,
      answer:
        "최근 트래픽 급증 사례에서 병목을 어떻게 측정했고 어떤 롤백 전략을 사용했는지 2~3문장으로 설명합니다.",
    })),
  );
  const ai = new SuccessAiClient(aiPayload);
  const prisma = createPrismaDouble();
  const repo = prisma as unknown as Pick<PrismaClient, "newsletterIssue">;

  const result = await createNewsletterIssue({
    category: InterestCategory.Backend,
    prisma: repo,
    aiClient: ai,
    publishDate: new Date("2024-12-01"),
  });

  const pairs = getQaPairs(result.issue);
  assert.equal(result.source, "ai");
  assert.equal(pairs.length, 5);
  assert.equal(prisma.createCount, 1);
});

test("falls back to static questions when Gemini fails", async () => {
  const ai = new FailingAiClient();
  const prisma = createPrismaDouble();
  const repo = prisma as unknown as Pick<PrismaClient, "newsletterIssue">;

  const result = await createNewsletterIssue({
    category: InterestCategory.DevOps,
    prisma: repo,
    aiClient: ai,
    publishDate: new Date("2024-12-02"),
  });

  const pairs = getQaPairs(result.issue);
  assert.equal(result.source, "fallback");
  assert.ok(pairs.every((pair) => pair.question.includes("DevOps")));
});

test("returns existing issue when duplicate creation attempted", async () => {
  const existing = buildIssue({
    id: "issue_123",
    category: InterestCategory.Java,
    publishDate: new Date("2024-12-03"),
    qaPairs: [
      {
        question: "기존 질문?",
        answer: "이전 답변입니다. 충분한 길이를 가진 텍스트를 제공합니다.",
      },
    ],
  });
  const prisma = createPrismaDouble(existing);
  const repo = prisma as unknown as Pick<PrismaClient, "newsletterIssue">;
  const ai = new FailingAiClient();

  const result = await createNewsletterIssue({
    category: InterestCategory.Java,
    prisma: repo,
    aiClient: ai,
    publishDate: existing.publishDate,
  });

  assert.equal(result.source, "existing");
  assert.equal(result.issue.id, "issue_123");
  assert.equal(prisma.createCount, 0);
});

function getQaPairs(issue: NewsletterIssue) {
  return (issue.qaPairs ?? []) as unknown as QAPair[];
}
