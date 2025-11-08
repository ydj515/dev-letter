# Dev Letter

Dev Letter는 AI가 생성하는 개발자용 뉴스레터와 인터랙티브 데모를 제공하는 토털 테크 콘텐츠 허브입니다. 구독자는 관심 분야를 선택해 맞춤형 콘텐츠를 받아보고, 실시간으로 면접 질문을 생성하거나 국내 기업 테크 블로그를 탐색할 수 있습니다.

## 주요 기능

- **맞춤 뉴스레터 구독**: 관심 카테고리를 선택하고 이메일을 제출하면 Prisma로 저장하며 Resend를 통해 확인 메일을 발송합니다.
- **AI 면접 질문 생성기**: 입력한 주제를 기반으로 질문을 생성하는 데모 페이지(`/demo`)를 제공합니다. 실제 Gemini API 연동 코드는 준비되어 있으며 현재는 샘플 데이터를 반환합니다.
- **테크 블로그 모음**: `/tech-blogs`에서 주요 IT 기업 블로그 링크를 빠르게 확인할 수 있습니다.
- **기술 스택 캐러셀**: Tailwind CSS로 구현된 무한 캐러셀에서 프로젝트에서 활용한 기술 스택을 시각화합니다.

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
```

- `RESEND_API_KEY`는 구독 확인 메일 발송에 사용합니다.
- `RESEND_FROM_EMAIL`은 Resend에서 인증한 발신 주소를 설정합니다(샌드박스 기본값은 `onboarding@resend.dev`).
- `GEMINI_API_KEY`는 `/api/user-input`과 실제 질문 생성 로직에 사용합니다. 키가 없으면 질문 생성기는 샘플 데이터를 반환합니다.

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

## 페이지 & API 요약

- `/` : 구독 폼, 기술 스택 캐러셀, 주요 페이지 링크
- `/demo` : AI 면접 질문 생성 데모
- `/tech-blogs` : 국내 주요 테크 기업 블로그 링크
- `POST /api/subscribe` : Prisma에 구독자를 저장하고 확인 메일 발송
- `POST /api/generate-questions` : Gemini 연동(샘플 응답 기본값)을 통한 질문 생성
- `POST /api/user-input` : 자유 입력 프롬프트를 Gemini 2.0 Flash로 전달하고 결과 반환

## NPM 스크립트

- `npm run dev` : Turbopack 기반 개발 서버 실행
- `npm run build` : SVG 린트 → Prisma 클라이언트 생성 → Next.js 빌드
- `npm run start` : 프로덕션 서버 실행
- `npm run lint` : Next.js 린트 실행
- `npm run lint:svg` : `public/**/*.svg` 파일 검사
- `npm run seed:newsletter` : 카테고리별 샘플 뉴스레터 이슈와 질문/답변 세트를 생성
- `npm run analyze:subs` : 구독자 관심사 분포 및 유효성 검사를 콘솔 리포트로 출력
- `npm run test:newsletter` : Gemini 목킹 기반 콘텐츠 파이프라인 인수 테스트 실행

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
