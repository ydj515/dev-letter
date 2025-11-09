import { DeliveryStatus, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../lib/prisma";

type IssueMetricRepository = Pick<PrismaClient, "issueDelivery" | "issueMetric">;

export interface IssueMetricsSnapshot {
  issueId: string;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  successRate: number;
  lastCalculatedAt: Date;
}

export async function recordIssueMetrics(
  issueId: string,
  prisma: IssueMetricRepository = defaultPrisma,
): Promise<IssueMetricsSnapshot> {
  const aggregates = await prisma.issueDelivery.groupBy({
    by: ["status"],
    where: { issueId },
    _count: { _all: true },
  });

  const counts = {
    [DeliveryStatus.SENT]: 0,
    [DeliveryStatus.FAILED]: 0,
    [DeliveryStatus.PENDING]: 0,
  };

  for (const aggregate of aggregates) {
    counts[aggregate.status as DeliveryStatus] = aggregate._count._all;
  }

  const total =
    counts[DeliveryStatus.SENT] + counts[DeliveryStatus.FAILED] + counts[DeliveryStatus.PENDING];
  const successRate = total > 0 ? counts[DeliveryStatus.SENT] / total : 0;
  const lastCalculatedAt = new Date();

  const metric = await prisma.issueMetric.upsert({
    where: { issueId },
    update: {
      sentCount: counts[DeliveryStatus.SENT],
      failedCount: counts[DeliveryStatus.FAILED],
      pendingCount: counts[DeliveryStatus.PENDING],
      successRate,
      lastCalculatedAt,
    },
    create: {
      issueId,
      sentCount: counts[DeliveryStatus.SENT],
      failedCount: counts[DeliveryStatus.FAILED],
      pendingCount: counts[DeliveryStatus.PENDING],
      successRate,
      lastCalculatedAt,
    },
  });

  return {
    issueId,
    sentCount: metric.sentCount,
    failedCount: metric.failedCount,
    pendingCount: metric.pendingCount,
    successRate: metric.successRate,
    lastCalculatedAt,
  };
}
