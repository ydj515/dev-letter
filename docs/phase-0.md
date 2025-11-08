# Phase 0 — Groundwork Notes

## 1. 발행 주기 & 카테고리 정의

- `src/constants/index.ts`에 선언된 `INTEREST_CATEGORIES`를 하루에 하나씩 순환합니다. 코드/문서 어디서든 동일 상수를 참조해 카테고리 변경 시 일관성이 유지되도록 합니다.
- 기본 규칙 (UTC 기준 00:30 발행, 추후 구독자별 시간대로 확장 가능):

  ```ts
  import { INTEREST_CATEGORIES } from "@/constants";

  const categories = INTEREST_CATEGORIES;

  export function pickCategoryFor(date: Date) {
    const dayNumber = Math.floor(date.getTime() / (1000 * 60 * 60 * 24));
    return categories[dayNumber % categories.length];
  }
  ```

- 신규 카테고리를 추가할 경우 `INTEREST_CATEGORIES` → 순환 로직 → 이메일 템플릿 순으로 영향을 점검합니다.
- 특정 카테고리를 건너뛰려면 `skipDates`(예정) 또는 `NewsletterIssue` 상태를 `draft`로 두고 승인 플로우를 추가하는 방식을 고려합니다.

## 2. 구독 데이터 분석 & 중복 식별

- `scripts/analyze-subscribers.mjs`를 통해 현재 구독 정보를 점검합니다.

  ```bash
  npm run analyze:subs
  ```

- 출력 항목:
  - 총 구독자 수
  - 카테고리별 포함 인원 수
  - 다중 관심사 조합 TOP-N
  - 유효하지 않은 관심사 문자열 및 발생 횟수
  - 관심사 미지정/비어 있는 구독자 수
- 결과를 바탕으로 중복 입력이나 잘못된 카테고리를 Phase 1 이후 정비합니다.

## 3. Resend 발송 한도 점검

- 현재는 `RESEND_FROM_EMAIL` 기본값(`onboarding@resend.dev`)을 사용하므로 프로덕션 전환 시 커스텀 도메인 인증이 필요합니다.
- Resend 대시보드 **Settings → Usage**에서 발송 한도와 레이트 리밋을 확인하고 기록합니다.
- 대량 발송 전략:
  - 하루 발행량이 한도를 초과하면 시간을 나눠 배치 전송합니다.
  - 커스텀 도메인 사용 시 1분당 10~20건 수준으로 시작하고 필요 시 상향 조정 요청을 준비합니다.
- 실패/재시도 정책은 Phase 4에서 구현하지만, 한도 초과(HTTP 429) 시 재시도 큐로 되돌리는 전략을 미리 검토합니다.

## 4. Gemini 사용량 & 프롬프트 초안

- 기본 프롬프트 구조:

  ```
  You are an expert technical interviewer specialising in {{category}}.
  Generate 5 senior-level interview question & model-answer pairs in Korean.
  Each pair should:
  - Focus on practical architecture/trade-offs/incident response.
  - Avoid trivia-style questions or simple definitions.
  Return a JSON array of {"question": string, "answer": string}.
  ```

- 카테고리별 컨텍스트는 `INTEREST_CATEGORIES` 값을 기준으로 조건 분기하거나 사전 매핑을 준비합니다(예: Backend → 분산 시스템, AI/ML → 모델 운영).
- 사용량 추정:
  - 입력 토큰: 프롬프트(~250) + 컨텍스트(~100) ≈ 350 tokens
  - 출력 토큰: 질문 5개 × 50 tokens ≈ 250 tokens
  - 하루 8개 카테고리 모두 생성 시 약 4,800 tokens → 월 약 150k tokens
  - 정확한 비용은 [Google AI Studio Pricing](https://ai.google.dev/pricing)의 `Gemini 2.0 Flash` 단가를 기준으로 갱신합니다.
- 사용량 로깅은 Phase 2에서 유틸로 처리하되, 비용 관리를 위해 일/월 단위 통계 저장을 염두에 둡니다.
