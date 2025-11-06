#!/usr/bin/env node
import { PrismaClient, InterestCategory, DeliveryStatus, IssueStatus } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORY_CONFIG = [
  { label: "Backend", value: InterestCategory.Backend },
  { label: "Database", value: InterestCategory.Database },
  { label: "Network", value: InterestCategory.Network },
  { label: "Java", value: InterestCategory.Java },
  { label: "Spring", value: InterestCategory.Spring },
  { label: "DevOps", value: InterestCategory.DevOps },
  { label: "Frontend", value: InterestCategory.Frontend },
  { label: "AI/ML", value: InterestCategory.AI_ML },
];

const SAMPLE_QUESTIONS = (category) => [
  `${category} 관련 아키텍처 의사결정에서 최근에 가장 어려웠던 사례를 설명해 주세요.`,
  `${category} 영역에서 SLA(또는 성능) 목표를 충족하기 위해 적용한 모니터링/관측 전략은 무엇인가요?`,
  `${category} 분야에서 기술 부채를 줄이기 위해 사용한 프로세스와 의사결정 기준을 알려주세요.`,
  `${category} 관련 장애가 발생했을 때, RCA를 어떻게 수행하고 재발 방지책을 설계했나요?`,
  `${category} 트렌드 중 내년까지 주목할 만한 기술과 그 이유를 설명해 주세요.`,
];

function startOfDay(date = new Date()) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

async function main() {
  const subscribers = await prisma.subscriber.findMany();
  const publishDate = startOfDay();
  const summary = [];

  for (const { label, value } of CATEGORY_CONFIG) {
    const issue = await prisma.newsletterIssue.upsert({
      where: {
        category_publishDate: {
          category: value,
          publishDate,
        },
      },
      update: {},
      create: {
        category: value,
        publishDate,
        title: `Dev Letter Daily • ${label}`,
        status: IssueStatus.DRAFT,
        questions: SAMPLE_QUESTIONS(label),
        generatedAt: new Date(),
        scheduledFor: publishDate,
      },
    });

    let deliveryCount = 0;

    for (const subscriber of subscribers) {
      if (!subscriber.interests?.includes(label)) {
        continue;
      }

      await prisma.issueDelivery.upsert({
        where: {
          issueId_subscriberId: {
            issueId: issue.id,
            subscriberId: subscriber.id,
          },
        },
        update: {},
        create: {
          issueId: issue.id,
          subscriberId: subscriber.id,
          status: DeliveryStatus.PENDING,
        },
      });

      deliveryCount += 1;

      if (!subscriber.lastSentAt || subscriber.lastSentAt < publishDate) {
        await prisma.subscriber.update({
          where: { id: subscriber.id },
          data: { lastSentAt: publishDate },
        });
      }
    }

    summary.push({ category: label, deliveries: deliveryCount });
  }

  console.log("Seed completed for publishDate:", publishDate.toISOString());
  console.table(summary);
}

main()
  .catch((error) => {
    console.error("Failed to seed newsletter data:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
