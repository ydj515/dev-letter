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

const SAMPLE_QA_PAIRS = (category) => {
  const questions = [
    `${category} 관련 아키텍처 의사결정에서 최근에 가장 어려웠던 사례를 설명해 주세요.`,
    `${category} 영역에서 SLA(또는 성능) 목표를 충족하기 위해 적용한 모니터링/관측 전략은 무엇인가요?`,
    `${category} 분야에서 기술 부채를 줄이기 위해 사용한 프로세스와 의사결정 기준을 알려주세요.`,
    `${category} 관련 장애가 발생했을 때, RCA를 어떻게 수행하고 재발 방지책을 설계했나요?`,
    `${category} 트렌드 중 내년까지 주목할 만한 기술과 그 이유를 설명해 주세요.`,
  ];

  const answers = [
    `${category} 플랫폼에 신규 트래픽 레이어를 도입하면서 서비스 의존성을 단계적으로 분리했고, SLO 99.5%를 유지하기 위해 릴리즈 플래그·카나리아 배포를 병행했습니다.`,
    `${category} 팀은 RED/Saturation 지표를 중심으로 된 대시보드를 구축하고, 예측 경고를 위해 히스토리 기반 임계치와 온콜용 런북을 함께 운영하고 있습니다.`,
    `${category} 관련 부채는 영향도/복잡도 2x2 매트릭스로 분류한 뒤, 분기마다 집중 스프린트를 확보해 반복적으로 해소했습니다.`,
    `${category} 장애 시에는 기능 플래그로 트래픽을 절반으로 내리고, 30분 내 RCA 문서를 작성해 재발 방지 태스크를 자동으로 생성했습니다.`,
    `${category} 트렌드 분석을 위해 사내 PoC 리포를 분기마다 공유하며, 성숙도와 ROI를 기준으로 실험 우선순위를 결정합니다.`,
  ];

  return questions.map((question, index) => ({
    question,
    answer:
      answers[index] ??
      `${category} 실무 경험과 정량적 지표를 바탕으로 의사결정 과정을 정리해 주세요.`,
  }));
};

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
        qaPairs: SAMPLE_QA_PAIRS(label),
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
