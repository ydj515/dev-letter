# Phase 0 — Groundwork Notes

## 1. 발행 주기 & 카테고리 정의

- INTEREST_CATEGORIES(`Backend`, `Database`, `Network`, `Java`, `Spring`, `DevOps`, `Frontend`, `AI/ML`)을 하루에 하나씩 순환합니다.
- 기본 규칙 (UTC 기준 00:30 발행, 이후 필요 시 구독자의 지역/선호 시간대로 확장):

  ```ts
  const categories = [
    "Backend",
    "Database",
    "Network",
    "Java",
    "Spring",
    "DevOps",
    "Frontend",
    "AI/ML",
  ];

  function pickCategoryFor(date: Date) {
    const dayNumber = Math.floor(date.getTime() / (1000 * 60 * 60 * 24));
    return categories[dayNumber % categories.length];
  }
  ```

- 신규 카테고리를 추가할 경우 `INTEREST_CATEGORIES` → 순환 로직 → 템플릿에서 동일하게 반영합니다.
- 특정 카테고리를 건너뛰고 싶다면 `skipDates`를 관리하거나, `NewsletterIssue` 상태를 `draft`로 두고 발행 여부를 승인이 필요하도록 설계합니다.

## 2. 구독 데이터 분석 & 중복 식별

- `scripts/analyze-subscribers.mjs`를 추가했습니다.
  ```bash
  npm run analyze:subs
  ```
- 출력 항목:
  - 총 구독자 수
  - 카테고리별 포함 인원 수
  - 다중 관심사 조합 Top-N
  - 유효하지 않은 관심사 문자열 및 발생 횟수
  - 구독자 중 관심사 미지정/비어 있는 경우
- 결과를 기반으로 중복 카테고리 입력, 구독자 관심사 업데이트 정책 등 후속 조치를 Phase 1에서 반영합니다.

## 3. Resend 발송 한도 점검

- 현재 프로젝트는 `onboarding@resend.dev` 발신 주소만 설정되어 있으므로 프로덕션 전환 시 커스텀 도메인 인증이 필요합니다.
- Resend 대시보드에서 **Settings → Usage**를 확인하고, 발송 한도(플랜 및 레이트 리밋)를 기록하세요.
- 대량 발송 전략:
  - 일 단위 발행량이 한도를 초과하면 시간을 나눠 배치 전송합니다.
  - 커스텀 도메인 사용 시 1분당 10~20건 수준으로 점진 시작 후, Resend 지원을 통해 레이트 리밋 상향 요청을 준비합니다.
- 실패/재시도 정책은 Phase 4에서 구현하지만, 한도 초과 시 429 응답을 잡 큐로 되돌리는 전략이 필요합니다.

## 4. Gemini 사용량 & 프롬프트 초안

- 기본 프롬프트 구조:
  ```
  You are an expert technical interviewer specialising in {{category}}.
  Generate 5 senior-level interview questions in Korean.
  Each question should:
  - Focus on practical architecture/trade-offs/incident response.
  - Avoid trivia-style questions or simple definitions.
  Return a JSON array of strings (UTF-8).
  ```
- 카테고리별 컨텍스트(예: `Backend` → "분산 시스템, API 설계"; `AI/ML` → "모델 운영, 데이터 파이프라인")를 앞부분에 부가합니다.
- 사용량 추정:
  - 입력 토큰: 프롬프트(약 250 tokens) + 컨텍스트(약 100 tokens) ≈ 350 tokens
  - 출력 토큰: 질문 5개 × 50 tokens ≈ 250 tokens
  - 하루 8개 카테고리를 모두 생성하면 4,800 tokens 정도 → 월 약 150k tokens
  - 정확한 비용은 [Google AI Studio Pricing](https://ai.google.dev/pricing)에서 `Gemini 2.0 Flash` 기준 단가를 확인해 갱신하세요.
- 사용량 로깅은 Phase 2에서 유틸에서 처리하되, 비용 관리를 위해 일/월 단위 통계를 저장할 준비를 합니다.
