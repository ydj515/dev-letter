# Phase 4 — 이메일 템플릿 & 발송 로직

Phase 4는 자동 발행 큐를 실 사용자 메일링까지 연결하는 단계였다. 목표는 **반복 가능한 이메일 템플릿, 안정적인 Resend 배치 발송, 수신 거부 플로우**를 한 번에 정리하는 것이었다.

## 1. React Email 템플릿 & 렌더링 유틸

- `src/emails/DailyNewsletter.tsx`에 Tailwind 기반 React Email 템플릿을 추가했다. 카테고리·발행일·질문/답변 리스트·CTA 버튼·푸터 공지를 포함한다.
- `src/lib/email.ts`에서 HTML/텍스트 버전을 동시에 렌더링하고, Q/A 스니펫으로 프리뷰 텍스트를 생성한다. 템플릿은 기본적으로 5개의 QA만 노출해 길이를 제어한다.
- 모든 발송 메일에는 CTA 링크(서비스 데모로 연결)와 한국어 안내문, `List-Unsubscribe/List-Unsubscribe-Post` 헤더, 고유 수신 거부 링크가 포함된다.

## 2. Resend 배치 발송 서비스

- `src/services/newsletter-delivery.ts`에 `sendNewsletterIssue`를 구현했다.
  - `IssueDelivery`를 배치 단위(기본 40건)로 가져와 React Email 템플릿을 렌더링하고 Resend `batch.send`로 일괄 전송한다.
  - 배치 실패 시 최대 3회까지 재시도하고, 그래도 실패하면 `DeliveryStatus.FAILED` 및 오류 메시지를 기록한다.
  - 발송 성공 시 `IssueDelivery.sentAt`/`Subscriber.lastSentAt`/`NewsletterIssue.sentAt`을 업데이트한다. 이미 수신 거부된 구독자는 즉시 `FAILED` 처리하며 집계에서 `skipped`로 분리한다.
  - Resend/APP_BASE_URL/발신 주소가 비어 있으면 발송 단계를 `disabled` 상태로 리포트해 로컬 개발에서도 잡을 안전하게 실행할 수 있다.
- `src/services/newsletter-cron.ts`는 큐 등록 이후 `sendNewsletterIssue`를 호출하고, 백로그 이슈 역시 동일 서비스로 발송한다. `cron:send` CLI 출력에 배치/성공/실패 통계를 추가했다.

## 3. 수신 거부 & 토큰 관리

- Prisma `Subscriber` 모델에 `unsubscribedAt`, `unsubscribeToken`을 추가하고 기존 레코드에 무작위 토큰을 백필했다.
- `/api/unsubscribe` Route Handler를 추가해 `token`/`delivery` 쿼리로 수신 거부를 처리한다. 이미 해지된 계정은 안내만 반환하며, 아직 발송되지 않은 딜리버리는 `FAILED`로 갱신한다.
- `runNewsletterCron`이 생성한 모든 이메일은 해당 토큰이 포함된 링크를 CTA/헤더에 포함한다. `.env-sample`과 README에 `APP_BASE_URL` 문서를 추가해 링크 기준 URL을 명시했다.
- 구독 API는 `unsubscribedAt`이 존재하는 경우 관심사를 갱신하며 재활성화할 수 있게 수정했다.

## 4. 테스트 & 품질 가드

- `tests/newsletter-delivery.test.ts`에서 인메모리 Prisma 더블과 스텁 이메일 클라이언트를 사용해 ▲정상 발송 ▲재시도 후 실패 ▲수신 거부 스킵 시나리오를 검증했다.
- Phase 4 TODO 항목을 완료 처리했고, README/API 목록에 수신 거부 엔드포인트를 추가했다.

이제 Cron 잡 한 번으로 **콘텐츠 생성 → 큐 등록 → Resend 배치 발송 → 수신 거부 처리**까지 전부 자동화된다. 운영 환경에서는 Resend/APP_BASE_URL만 세팅하면 바로 실사용자에게 뉴스레터를 배포할 수 있다.
