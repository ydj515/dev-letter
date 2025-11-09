# Dev Letter

Dev Letter는 AI가 생성하는 개발자용 뉴스레터와 인터랙티브 데모를 제공하는 토털 테크 콘텐츠 허브입니다. 구독자는 관심 분야를 선택해 맞춤형 콘텐츠를 받아보고, 실시간으로 면접 질문을 생성하거나 국내 기업 테크 블로그를 탐색할 수 있습니다.

## 주요 기능

- **맞춤 뉴스레터 구독**: 관심 카테고리를 선택하고 이메일을 제출하면 Prisma로 저장하며 Resend를 통해 확인 메일을 발송합니다.
- **AI 면접 질문 생성기**: 입력한 주제를 기반으로 질문을 생성하는 데모 페이지(`/demo`)를 제공합니다. 실제 Gemini API 연동 코드는 준비되어 있으며 현재는 샘플 데이터를 반환합니다.
- **테크 블로그 모음**: `/tech-blogs`에서 주요 IT 기업 블로그 링크를 빠르게 확인할 수 있습니다.
- **기술 스택 캐러셀**: Tailwind CSS로 구현된 무한 캐러셀에서 프로젝트에서 활용한 기술 스택을 시각화합니다.
- **관리자 콘솔**: `/admin` 페이지에서 발행 이슈를 미리보고 승인·재발송·즉시 생성, Slack 알림과 메트릭 확인까지 한 번에 처리합니다.

## 전체 아키텍처

```mermaid
%%{init: {"flowchart": {"curve": "basis", "nodeSpacing": 40, "rankSpacing": 60}}}%%
flowchart LR
    subgraph Client
      U[Landing /admin UI]
    end

    subgraph AppRouter["Next.js App Router"]
      API1[/api/subscribe/]
      API2[/api/cron/newsletter/]
      API3[/api/unsubscribe/]
      Admin[/admin actions/]
    end

    subgraph Services
      Cron[Newsletter Cron<br/>scheduler]
      IssueSvc[newsletter-issue.ts<br/>AI+fallback]
      DeliverySvc[newsletter-delivery.ts<br/>Resend batch]
      Metrics[issue-metrics.ts]
    end

    subgraph External
      DB[(PostgreSQL/Prisma)]
      Resend[(Resend)]
      Gemini[(Google Gemini 2.x)]
      Slack[(Slack Webhook)]
      Email[구독자]
    end

    U -->|구독 요청| API1
    API1 --> DB
    API2 --> Cron
    Cron --> IssueSvc --> Gemini
    IssueSvc --> DB
    Cron --> DeliverySvc --> Resend --> Email
    DeliverySvc --> DB
    DeliverySvc --> Metrics --> DB
    DeliverySvc -. "실패 알림" .-> Slack
    Admin --> Cron
    Admin --> DeliverySvc
    API3 --> DB
```

### 발행 플로우

1. **카테고리 스케줄링**: `newsletter-cron.ts`가 회전 규칙을 계산하여 오늘의 카테고리와 발행일을 결정합니다.
2. **콘텐츠 생성**: `newsletter-issue.ts`가 선택된 카테고리를 바탕으로 프롬프트를 만들고 Gemini 2.x Flash 모델에 요청합니다.  
   - 응답이 JSON 형식으로 들어오면 `normalizeQaPairs`로 정규화하여 `NewsletterIssue.qaPairs`에 저장합니다.  
   - 실패하거나 파싱할 수 없는 경우 `buildFallbackQaPairs`가 준비한 고품질 Q/A 템플릿을 채웁니다.
3. **발송 큐 구성**: `ensureDeliveriesForIssue`가 관심사가 일치하고 아직 보내지 않은 구독자를 찾아 `IssueDelivery`를 생성하고, 이슈 상태를 `SCHEDULED`로 변경합니다.
4. **배치 발송**: `newsletter-delivery.ts`의 `sendNewsletterIssue`가 React Email 템플릿을 렌더링하여 Resend `batch.send`로 전송합니다.  
   - 구독 해지를 요청한 사용자는 `FAILED` 처리합니다.  
   - 재시도 한도까지 실패하면 에러 메시지를 `IssueDelivery.error`에 저장합니다.  
   - 발송 후 `IssueMetric`을 업데이트하여 `/admin`에서 성공률/실패 건수를 즉시 확인할 수 있습니다.
5. **관측성**: 발송 실패·Cron 예외·Disabled 상황은 `src/lib/alerts.ts`를 통해 Slack Webhook으로 전달됩니다.

### 관리자 콘솔 플로우

- `/admin/login`에서 단일 운영 계정으로 기본 인증 후 접속합니다(쿠키 기반 세션).
- 대시보드에서는
  - 최신 이슈 카드: QA 미리보기·대상자 수·성공률·상태 표시
  - “즉시 생성” 폼: 카테고리/발행일을 선택해 AI 생성 파이프라인을 바로 실행
  - 승인/재발송 버튼: `ensureDeliveriesForIssue`/`sendNewsletterIssue`를 온디맨드로 호출
  - 감사 로그: 모든 액션(`approve_issue`, `resend_issue`, `generate_issue`)을 `AdminActionLog`에 JSON 메타데이터와 함께 기록
- 재발송 시에는 실패한 딜리버리(`FAILED`)도 자동으로 큐에 되돌려 재전송합니다.

### 시퀀스 다이어그램

```mermaid
sequenceDiagram
    autonumber
    participant Cron as Cron Scheduler
    participant IssueSvc as newsletter-issue.ts
    participant Gemini as Gemini API
    participant DB as Prisma/Postgres
    participant Delivery as newsletter-delivery.ts
    participant Resend as Resend API
    participant Slack as Alerts

    Cron->>DB: 미발송 이슈 조회 / 구독자 필터링
    Cron->>IssueSvc: createNewsletterIssue(category, publishDate)
    IssueSvc->>Gemini: generateContent(prompt)
    Gemini-->>IssueSvc: QA JSON / 텍스트
    IssueSvc->>DB: NewsletterIssue 저장
    Cron->>Delivery: sendNewsletterIssue(issueId)
    loop Batch
        Delivery->>DB: PENDING IssueDelivery 조회
        Delivery->>Resend: batch.send(payload)
        alt 성공
            Delivery->>DB: IssueDelivery SENT 업데이트
        else 실패/재시도
            Delivery->>DB: FAILED + error 저장
        end
    end
    Delivery->>DB: IssueMetric upsert
    Delivery-->>Slack: 실패 알림 (필요 시)
```

### 운영 모드 플로우 예시

1. **구독자 증가**: `/api/subscribe`가 이메일+관심사를 Prisma에 저장하고 Resend 확인 메일을 전송합니다.
2. **매일 자정 Cron**: Vercel Cron(또는 자체 워커)이 `POST /api/cron/newsletter`를 호출해 자동 발행 파이프라인을 실행합니다.
3. **문제 감지**: Resend 오류나 Cron 예외는 Slack Webhook으로 알림이 오며, `/admin` 대시보드에서 실패 건수를 즉시 확인할 수 있습니다.
4. **운영자 개입**: `/admin`에서 즉시 콘텐츠 생성 → 승인 → 재발송을 수동으로 트리거할 수 있습니다. 모든 액션은 `AdminActionLog`에 기록되어 감사 추적이 가능합니다.

## 기술 스택

- **프론트엔드**: Next.js 15(App Router), React 19, TypeScript, Tailwind CSS
- **백엔드/API**: Next.js API Routes, Resend(이메일 발송), Google Generative AI SDK
- **데이터**: PostgreSQL, Prisma ORM
- **기타**: @react-email/components(이메일 템플릿), svglint(SVG 품질 검사)

## 디렉터리 구조

```text
src/
├─ app/                # App Router 페이지 및 API 엔드포인트
│  ├─ page.tsx         # 랜딩 페이지 및 구독 폼
│  ├─ demo/            # AI 면접 질문 생성기 페이지
│  ├─ tech-blogs/      # 테크 블로그 링크 페이지
│  └─ api/             # 구독·질문 생성·자유 입력 API
├─ components/         # UI 컴포넌트(예: TechCarousel)
├─ constants/          # 관심사 목록, 캐러셀 아이콘, 블로그 목록
└─ emails/             # React Email 기반 구독 확인 템플릿
```

## 빠른 시작

### 1. 선행 요구사항

- Node.js 20 이상
- PostgreSQL 데이터베이스
- Resend 계정(이메일 발송), Google Gemini API 키(선택 기능)

### 2. 프로젝트 세팅

```bash
git clone https://github.com/your-username/dev-letter.git
cd dev-letter
npm install
```

### 3. 환경 변수 구성

프로젝트 루트에 `.env-sample`을 참고하여 `.env` 파일을 만들고 아래 값을 채웁니다.

```env
DATABASE_URL="postgres://user:password@host:5432/dbname"
PRISMA_DATABASE_URL="postgres://user:password@host:5432/dbname"
RESEND_API_KEY="your_resend_api_key"
RESEND_FROM_EMAIL="onboarding@your-domain.com"
GEMINI_API_KEY="your_google_gemini_api_key"
CRON_SECRET="randomly_generated_string"
APP_BASE_URL="your_domain"
ADMIN_USERNAME="your_admin_id"
ADMIN_PASSWORD="your_admin_password"
```

- `RESEND_API_KEY`는 구독 확인 메일 발송에 사용합니다.
- `RESEND_FROM_EMAIL`은 Resend에서 인증한 발신 주소를 설정합니다(샌드박스 기본값은 `onboarding@resend.dev`).
- `GEMINI_API_KEY`는 `/api/user-input`과 실제 질문 생성 로직에 사용합니다. 키가 없으면 질문 생성기는 샘플 데이터를 반환합니다.
- `CRON_SECRET`은 Vercel Cron(Webhook) 혹은 외부 워커가 `/api/cron/newsletter` 엔드포인트를 호출할 때 사용하는 shared secret입니다.
- `APP_BASE_URL`은 템플릿 내 CTA/수신 거부 링크를 생성하고 `List-Unsubscribe` 헤더에 포함되는 기준 URL입니다.

### 4. 데이터베이스 마이그레이션

```bash
npx prisma migrate dev --name init
npx prisma generate
npx prisma migrate deploy # 새 마이그레이션 "생성"은 금지, "적용만" 합니다.
```

필요하다면 샘플 뉴스레터 데이터를 추가해 새 스키마 구조를 확인합니다.

```bash
npm run seed:newsletter
```

### 5. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000`을 열어 애플리케이션을 확인합니다.

## 프로덕션 빌드

```bash
npm run build
npm run start
```

Vercel 또는 Next.js가 지원하는 기타 플랫폼에 손쉽게 배포할 수 있습니다.

## 자동 발행 Cron

1. `.env`에 `CRON_SECRET`을 설정합니다.
2. Vercel Cron(또는 기타 워커)에서 `POST https://<domain>/api/cron/newsletter`를 호출하도록 스케줄을 추가합니다.
   - 헤더 `Authorization: Bearer <CRON_SECRET>`를 반드시 포함합니다.
3. 잡은 아래 단계를 실행합니다.
   - 최근 3일간 `SENT`로 전환되지 않은 이슈를 재큐잉합니다.
   - 순환 규칙에 따라 오늘 발행할 카테고리를 선택하고 `NewsletterIssue`를 생성합니다.
   - 관심사가 일치하고 당일 발송 이력이 없는 구독자를 찾아 `IssueDelivery`를 생성하고 상태를 `SCHEDULED`로 전환합니다.
   - React Email 템플릿을 HTML/텍스트로 렌더링한 뒤 Resend 배치 발송을 수행하고, 결과를 `IssueDelivery`(`SENT/FAILED`)에 기록합니다. 모든 이메일에는 CTA·`List-Unsubscribe` 헤더·수신 거부 링크가 포함됩니다.
4. 로컬에서 동일한 로직을 수동으로 실행하고 싶은 경우 `npm run cron:send`를 사용합니다. `npm run cron:send -- --date=2025-11-09`처럼 특정 일자를 지정할 수도 있습니다.

## 페이지 & API 요약

- `/` : 구독 폼, 기술 스택 캐러셀, 주요 페이지 링크
- `/demo` : AI 면접 질문 생성 데모
- `/tech-blogs` : 국내 주요 테크 기업 블로그 링크
- `POST /api/subscribe` : Prisma에 구독자를 저장하고 확인 메일 발송
- `POST /api/generate-questions` : Gemini 연동(샘플 응답 기본값)을 통한 질문 생성
- `POST /api/user-input` : 자유 입력 프롬프트를 Gemini 2.0 Flash로 전달하고 결과 반환
- `GET /api/unsubscribe` : 수신 거부 토큰/딜리버리 ID를 바탕으로 구독을 비활성화하고 확인 페이지를 반환

## NPM 스크립트

- `npm run dev` : Turbopack 기반 개발 서버 실행
- `npm run build` : SVG 린트 → Prisma 클라이언트 생성 → Next.js 빌드
- `npm run start` : 프로덕션 서버 실행
- `npm run lint` : Next.js 린트 실행
- `npm run lint:svg` : `public/**/*.svg` 파일 검사
- `npm run seed:newsletter` : 카테고리별 샘플 뉴스레터 이슈와 질문/답변 세트를 생성
- `npm run analyze:subs` : 구독자 관심사 분포 및 유효성 검사를 콘솔 리포트로 출력
- `npm run test:newsletter` : Gemini 목킹 기반 콘텐츠 파이프라인 인수 테스트 실행
- `npm run cron:send` : 뉴스레터 스케줄러를 수동 실행하며 발행/발송 큐를 재구성

## 에디터 & 포맷팅

- 저장 시 Prettier가 적용되도록 `.vscode/settings.json`, `.prettierrc.json`, `.editorconfig`를 포함하고 있습니다.
- VS Code 기준 권장 확장:
  - ESLint (dbaeumer.vscode-eslint)
  - Prettier – Code formatter (esbenp.prettier-vscode)
- 포맷 규칙 요약: 2칸 스페이스 들여쓰기, 더블 쿼트, 세미콜론 유지, LF 줄바꿈.
- CLI에서 전체 포맷을 맞추고 싶다면 다음을 실행하세요.

```bash
npx prettier --write .
```

## 참고 사항

- Resend 기본 발신 주소(`onboarding@resend.dev`)는 샌드박스용이며, 실제 서비스에서는 도메인 인증 후 사용자 정의 주소로 변경해야 합니다.
- `generate-questions` API에서 Gemini 응답을 사용하려면 주석 처리된 코드를 활성화하고 `GEMINI_API_KEY`를 설정해야 합니다.
