import {
  InterestCategory,
  IssueStatus,
  Prisma,
  type NewsletterIssue,
  type PrismaClient,
} from "@prisma/client";
import { prisma as defaultPrisma } from "../lib/prisma";
import { getCategoryLabel, listCategoryRotation } from "../lib/categories";
import { startOfDay } from "../lib/utils";
import type { QAPair } from "../lib/qa";
import { ensureDeliveriesForIssue } from "./newsletter-cron";
import { sendNewsletterIssue } from "./newsletter-delivery";
import { createNewsletterIssue, type IssueCreationSource } from "./newsletter-issue";

type AdminRepository = PrismaClient;

export interface DashboardIssueMetric {
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  successRate: number;
  lastCalculatedAt: string;
}

export interface DashboardIssue {
  id: string;
  title: string;
  category: InterestCategory;
  categoryLabel: string;
  publishDate: string;
  status: IssueStatus;
  scheduledFor: string | null;
  sentAt: string | null;
  qaPairs: QAPair[];
  deliveries: number;
  metric?: DashboardIssueMetric;
}

export interface DashboardAction {
  id: string;
  issueId: string | null;
  actor: string;
  action: string;
  issueTitle: string | null;
  categoryLabel: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface DashboardSummary {
  totalIssues: number;
  pendingIssues: number;
  failedIssues: number;
  averageSuccessRate: number;
  categories: { label: string; category: InterestCategory }[];
}

export interface AdminDashboardData {
  issues: DashboardIssue[];
  actions: DashboardAction[];
  summary: DashboardSummary;
}

interface FetchOptions {
  limit?: number;
  prisma?: AdminRepository;
}

export async function fetchAdminDashboardData(
  options: FetchOptions = {},
): Promise<AdminDashboardData> {
  const prisma = options.prisma ?? defaultPrisma;
  const limit = options.limit ?? 8;

  const [issues, actions] = await Promise.all([
    prisma.newsletterIssue.findMany({
      orderBy: { publishDate: "desc" },
      take: limit,
      include: {
        metric: true,
        _count: {
          select: {
            deliveries: true,
          },
        },
      },
    }),
    prisma.adminActionLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        issue: {
          select: {
            title: true,
            category: true,
          },
        },
      },
    }),
  ]);

  const serializedIssues = issues.map(serializeIssue);
  const serializedActions = actions.map(serializeAction);
  const summary = buildSummary(serializedIssues);

  return {
    issues: serializedIssues,
    actions: serializedActions,
    summary,
  };
}

export interface ApproveIssueResult {
  issueId: string;
  queue: Awaited<ReturnType<typeof ensureDeliveriesForIssue>>;
}

export async function approveIssue(
  issueId: string,
  actor: string,
  prisma: AdminRepository = defaultPrisma,
): Promise<ApproveIssueResult> {
  if (!actor) {
    throw new Error("Actor is required to approve an issue");
  }

  const issue = await prisma.newsletterIssue.findUnique({ where: { id: issueId } });
  if (!issue) {
    throw new Error("Issue not found");
  }

  const label = getCategoryLabel(issue.category);
  const queue = await ensureDeliveriesForIssue(prisma, issue, label, new Date());

  await logAdminAction(prisma, {
    issueId: issue.id,
    actor,
    action: "approve_issue",
    metadata: queue as unknown as Prisma.JsonObject,
  });

  return { issueId: issue.id, queue };
}

export interface ResendIssueResult {
  issueId: string;
  send: Awaited<ReturnType<typeof sendNewsletterIssue>>;
}

export async function resendIssue(
  issueId: string,
  actor: string,
  prisma: AdminRepository = defaultPrisma,
): Promise<ResendIssueResult> {
  if (!actor) {
    throw new Error("Actor is required to resend an issue");
  }

  const issue = await prisma.newsletterIssue.findUnique({ where: { id: issueId } });
  if (!issue) {
    throw new Error("Issue not found");
  }

  const send = await sendNewsletterIssue({ issue, prisma });

  await logAdminAction(prisma, {
    issueId: issue.id,
    actor,
    action: "resend_issue",
    metadata: {
      attempted: send.attempted,
      sent: send.sent,
      failed: send.failed,
      disabled: send.disabled ?? false,
      reason: send.reason ?? null,
    },
  });

  return { issueId: issue.id, send };
}

export interface GenerateIssueResult {
  issue: DashboardIssue;
  source: IssueCreationSource;
}

export async function generateIssue(
  params: {
    category: InterestCategory;
    publishDate?: Date;
  },
  actor: string,
  prisma: AdminRepository = defaultPrisma,
): Promise<GenerateIssueResult> {
  if (!actor) {
    throw new Error("Actor is required to generate an issue");
  }

  const publishDate = params.publishDate ? startOfDay(params.publishDate) : startOfDay();
  const { issue, source } = await createNewsletterIssue({
    category: params.category,
    publishDate,
    prisma,
  });

  const freshIssue = await prisma.newsletterIssue.findUnique({
    where: { id: issue.id },
    include: {
      metric: true,
      _count: { select: { deliveries: true } },
    },
  });

  if (!freshIssue) {
    throw new Error("Failed to reload generated issue");
  }

  await logAdminAction(prisma, {
    issueId: issue.id,
    actor,
    action: "generate_issue",
    metadata: {
      category: issue.category,
      publishDate: publishDate.toISOString(),
      source,
    },
  });

  return {
    issue: serializeIssue(freshIssue),
    source,
  };
}

async function logAdminAction(
  prisma: AdminRepository,
  entry: {
    issueId: string;
    actor: string;
    action: string;
    metadata?: Prisma.JsonValue;
  },
) {
  await prisma.adminActionLog.create({
    data: {
      issueId: entry.issueId,
      actor: entry.actor,
      action: entry.action,
      metadata: entry.metadata ?? Prisma.JsonNull,
    },
  });
}

function serializeIssue(
  issue: NewsletterIssue & {
    metric?: {
      sentCount: number;
      failedCount: number;
      pendingCount: number;
      successRate: number;
      lastCalculatedAt: Date;
    } | null;
    _count?: {
      deliveries: number;
    };
  },
): DashboardIssue {
  const qaPairs = parseQaPairs(issue.qaPairs);
  return {
    id: issue.id,
    title: issue.title,
    category: issue.category,
    categoryLabel: getCategoryLabel(issue.category),
    publishDate: issue.publishDate.toISOString(),
    status: issue.status,
    scheduledFor: issue.scheduledFor ? issue.scheduledFor.toISOString() : null,
    sentAt: issue.sentAt ? issue.sentAt.toISOString() : null,
    qaPairs,
    deliveries: issue._count?.deliveries ?? 0,
    metric: issue.metric
      ? {
          sentCount: issue.metric.sentCount,
          failedCount: issue.metric.failedCount,
          pendingCount: issue.metric.pendingCount,
          successRate: issue.metric.successRate,
          lastCalculatedAt: issue.metric.lastCalculatedAt.toISOString(),
        }
      : undefined,
  };
}

function serializeAction(entry: {
  id: string;
  issueId: string | null;
  actor: string;
  action: string;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  issue?: { title: string; category: InterestCategory } | null;
}): DashboardAction {
  return {
    id: entry.id,
    issueId: entry.issueId,
    actor: entry.actor,
    action: entry.action,
    metadata:
      entry.metadata && typeof entry.metadata === "object"
        ? (entry.metadata as Record<string, unknown>)
        : null,
    createdAt: entry.createdAt.toISOString(),
    issueTitle: entry.issue?.title ?? null,
    categoryLabel: entry.issue ? getCategoryLabel(entry.issue.category) : null,
  };
}

function parseQaPairs(json: unknown): QAPair[] {
  if (!Array.isArray(json)) return [];
  const pairs: QAPair[] = [];

  for (const entry of json) {
    if (!entry || typeof entry !== "object") continue;
    const { question, answer } = entry as QAPair;
    if (typeof question !== "string" || typeof answer !== "string") continue;
    pairs.push({ question, answer });
  }

  return pairs;
}

function buildSummary(issues: DashboardIssue[]): DashboardSummary {
  const totals = issues.reduce(
    (acc, issue) => {
      if (issue.status !== IssueStatus.SENT) {
        acc.pending += 1;
      }
      if ((issue.metric?.failedCount ?? 0) > 0) {
        acc.failed += 1;
      }
      if (issue.metric) {
        acc.successRates.push(issue.metric.successRate);
      }
      return acc;
    },
    { pending: 0, failed: 0, successRates: [] as number[] },
  );

  const avgSuccess =
    totals.successRates.length > 0
      ? totals.successRates.reduce((sum, rate) => sum + rate, 0) / totals.successRates.length
      : 0;

  return {
    totalIssues: issues.length,
    pendingIssues: totals.pending,
    failedIssues: totals.failed,
    averageSuccessRate: avgSuccess,
    categories: listCategoryRotation(),
  };
}
