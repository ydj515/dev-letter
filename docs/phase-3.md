# Phase 3 — 스케줄링 & 잡 인프라

Phase 3에서는 하루 한 카테고리씩 뉴스레터를 발행한다는 운영 가정을 실제 코드/인프라로 옮기는 데 집중했다. 목표는 **카테고리 순환 규칙 → 콘텐츠 생성 → 발송 큐 등록**까지 자동화된 파이프라인을 확보하는 것이다.

## 1. 일별 카테고리 선택 규칙

- `INTEREST_CATEGORIES` 배열 순서를 기준으로 **라운드 로빈** 순환 규칙을 구현했다.
- `src/lib/category-rotation.ts`의 `getDailyCategorySchedule` 함수가 기준 날짜(기본값은 오늘)를 start-of-day로 정규화하고, 기준(anchor) 날짜 대비 며칠 지났는지 계산해 카테고리를 결정한다.
- 기본 기준일은 `2025-11-09`이며, 필요한 경우 `cycleStartDate`를 전달해 재설정할 수 있다.
- `tests/category-rotation.test.ts`로 라운드 로빈 순환과 커스텀 기준일 케이스를 검증했다.

## 2. 카테고리 ↔ Prisma Enum 브리지

- 기존에는 `interest-categories.json`(라벨 문자열)과 Prisma의 `InterestCategory` enum 사이를 직접 매핑하지 않았다.
- `src/lib/categories.ts`에서 라벨 ↔ enum 매핑 유틸을 만들고, 순환 규칙 및 스케줄러 로직에서 일관되게 사용하도록 정리했다.
- `PROMPT_TEMPLATES`와 `NewsletterIssue` 생성 시 각각 동일한 라벨을 참조하도록 해, enum/라벨 불일치로 인한 실패를 방지한다.

## 3. 뉴스레터 크론 잡 파이프라인

`src/services/newsletter-cron.ts`에 전체 스케줄러 로직을 정의했다. 동작 순서는 다음과 같다.

1. **백로그 재처리:** 최근 3일 이내에 `SENT`로 전환되지 않은 `NewsletterIssue`를 조회해 관심사와 일치하는 구독자들의 `IssueDelivery`를 재등록한다.
2. **오늘자 이슈 생성:** 순환 규칙으로 오늘 날짜와 카테고리를 결정하고 `createNewsletterIssue`를 호출해 AI 생성(or fallback) 컨텐츠를 확보한다.
3. **발송 큐 생성:** 관심사 일치 + 해당 일자 미발송 구독자를 조회해 `IssueDelivery`를 생성(`skipDuplicates`)하고, 이슈 상태를 `SCHEDULED`로 업데이트한다.
4. **결과 반환:** 스케줄/이슈/백로그/발송 큐 수치를 한 번에 응답하도록 `runNewsletterCron`이 요약 데이터를 돌려준다.

## 4. 배포 타겟: Vercel Cron Webhook

- `/api/cron/newsletter`(App Router Route Handler)를 추가해 외부에서 POST 호출만으로 잡을 실행할 수 있게 했다.
- 헤더 `Authorization: Bearer <CRON_SECRET>` 검증으로 보호하며, `.env` / `.env.sample` / README에 `CRON_SECRET` 문서를 추가했다.
- Vercel Cron 행렬 예시
  ```text
  0 6 * * *  →  KST 15:00마다 /api/cron/newsletter 호출
  ```
  운영 환경에서는 `RESEND_API_KEY`, `DATABASE_URL`, `CRON_SECRET` 등을 ENV에 주입해야 한다.

## 5. 로컬/운영 공용 실행 스크립트

- `npm run cron:send` (`scripts/cron-send.ts`)으로 동일한 로직을 로컬에서도 손쉽게 실행할 수 있다.
- `--date=YYYY-MM-DD` 옵션으로 특정 날짜 스케줄을 강제로 생성하거나, 백로그 재시도 확인 등에 활용한다.
- CLI 스크립트는 이미 Next.js 서버 없이도 Prisma/AI 의존성을 모두 불러와 단독 실행된다.

## 6. TODO/README 반영

- Phase 3 항목을 TODO에서 완료 처리하고, README에 “자동 발행 Cron” 섹션을 추가해 운영 가이드를 기록했다.
- `.env-sample`에 `CRON_SECRET`을 포함시켜 배포 환경 변수를 빠뜨리지 않도록 했다.

---

Phase 3 결과로 **콘텐츠 생성 → 발송 큐 등록 → 백로그 복구**까지 하나의 잡으로 자동화되었고, Vercel Cron 또는 외부 워커에서 안전하게 실행할 수 있는 기본 토대를 마련했다. Phase 4에서는 이 큐를 실제 이메일 템플릿 및 Resend 발송 로직과 연결해 최종 사용자에게 전달하는 작업을 진행할 예정이다.
