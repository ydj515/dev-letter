# Phase 2 — AI 콘텐츠 생성 파이프라인

Phase 2에서는 “카테고리별 질문·답변 세트 자동 생성”이라는 핵심 요구를 만족시키기 위해 AI 연동, 프롬프트 템플릿, 후처리 유틸들을 정리했다. 목표는 **안정적인 Gemini 호출 → 구조화된 QA 결과 → NewsletterIssue 저장**까지를 자동화하는 것이다.

## 1. 프롬프트 템플릿 설계 (`src/lib/prompt-templates.ts`)

- `InterestCategory`별로 톤/포커스/질문 개수/온도/가이드라인을 정의했다.
- 공통 형식 요구사항: 결과는 JSON 배열, `{ question, answer }` 형태, 질문 1문장·200자 이하, 답변 2~3문장·600자 이하.
- 카테고리별 특화 가이드라인을 추가해 질문이 도메인 지식을 반영하도록 유도한다(예: DevOps는 릴리스 전략, Database는 격리 수준/백업 언급 등).

## 2. Gemini 호출 유틸 (`src/lib/ai.ts`)

- `GeminiClient`가 재시도/타임아웃/백오프를 포함해 `generateText`를 노출한다.
- `MODEL_PRICING`을 기반으로 입력/출력 토큰당 비용을 계산하고 메타데이터와 함께 콘솔에 로깅한다.
- 요청 메타데이터(카테고리, publishDate)를 포함해 추후 관측성을 높인다.
- 타임아웃 시 `runWithTimeout`, 재시도 여부 판별을 위한 `isRetryable` 유틸을 별도 함수로 분리했다.

## 3. QA 파서 & 폴백 (`src/lib/qa.ts`)

- Gemini 응답을 JSON/블록 텍스트 모두에서 파싱할 수 있도록 `normalizeQaPairs`를 구현했다.
- 질문/답변 길이 제한, 금칙어, 중복 여부 등을 검증한 뒤 기대 개수만큼 추출한다(부족하면 에러).
- 실패 시 사용할 기본 QA 세트를 `buildFallbackQaPairs`로 제공해 서비스 중단을 막는다.

## 4. NewsletterIssue 서비스 (`src/services/newsletter-issue.ts`)

1. 일자(start-of-day) + 카테고리로 이미 생성된 이슈가 있는지 확인 → 있으면 즉시 반환.
2. 프롬프트 생성 후 Gemini 호출 → 성공 시 정규화된 QA 배열 확보.
3. AI 생성 실패 또는 유효 QA 부족 시 fallback 세트를 자동으로 주입.
4. Prisma를 통해 `NewsletterIssue`를 생성하되, 유니크 제약(P2002) 충돌 시 기존 이슈를 재조회해 idempotent하게 처리.
5. 생성 결과는 `source: "ai" | "fallback" | "existing"`으로 호출자에게 알려준다.

## 5. 테스트 (`tests/newsletter-issue.test.ts`)

- 성공/실패/중복 케이스별로 Prisma·AI 더블을 사용해 `createNewsletterIssue`를 검증한다.
- QA 파서가 기대 개수를 만족하는지, fallback이 적절히 작동하는지 확인했다.
- 테스트는 `npm run test:newsletter`에 포함되어 Phase 3에서도 함께 실행된다.

## 6. 스크립트 & 데이터 시드

- `scripts/seed-newsletter.mjs`로 카테고리별 데일리 이슈를 생성하고 관심사가 일치하는 구독자의 `IssueDelivery`를 미리 만들어 둘 수 있다.
- QA 세트는 Phase 2에서 정의한 fallback 형식을 재사용해 빠르게 샘플 데이터를 구성한다.

---

Phase 2 결과로 프롬프트 설계 → Gemini 호출 → QA 정규화 → Prisma 저장까지 일관된 파이프라인이 준비되었으며, Phase 3의 스케줄러와 바로 연동할 수 있는 안정적인 생성 레이어를 확보했다.
