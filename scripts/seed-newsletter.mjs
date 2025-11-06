#!/usr/bin/env node
import { PrismaClient, InterestCategory, DeliveryStatus, IssueStatus } from "@prisma/client";
import interestCategories from "../src/constants/interest-categories.json" assert { type: "json" };

const prisma = new PrismaClient();

const toInterestCategoryValue = (label) => {
  const enumKey = label.replace(/\W+/g, "_");
  const value = InterestCategory[enumKey];

  if (!value) {
    throw new Error(`Unknown interest category label "${label}"`);
  }

  return value;
};

const CATEGORY_CONFIG = interestCategories.map((label) => ({
  label,
  value: toInterestCategoryValue(label),
}));

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
  const publishDate = startOfDay();
  const summary = [];
  const subscriberIdsToUpdate = new Set();

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

    const interestedSubscribers = await prisma.subscriber.findMany({
      where: {
        interests: {
          has: label,
        },
      },
      select: {
        id: true,
        lastSentAt: true,
      },
    });

    if (interestedSubscribers.length > 0) {
      const deliveriesToCreate = interestedSubscribers.map(({ id }) => ({
        issueId: issue.id,
        subscriberId: id,
        status: DeliveryStatus.PENDING,
      }));

      await prisma.issueDelivery.createMany({
        data: deliveriesToCreate,
        skipDuplicates: true,
      });

      for (const subscriber of interestedSubscribers) {
        if (!subscriber.lastSentAt || subscriber.lastSentAt < publishDate) {
          subscriberIdsToUpdate.add(subscriber.id);
        }
      }
    }

    summary.push({ category: label, deliveries: interestedSubscribers.length });
  }

  if (subscriberIdsToUpdate.size > 0) {
    await prisma.subscriber.updateMany({
      where: {
        id: {
          in: Array.from(subscriberIdsToUpdate),
        },
      },
      data: {
        lastSentAt: publishDate,
      },
    });
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
