import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";
import type { QAPair } from "../lib/qa";

export interface DailyNewsletterProps {
  issueTitle: string;
  categoryLabel: string;
  publishDate: string;
  qaPairs: QAPair[];
  ctaUrl: string;
  unsubscribeUrl: string;
  previewText: string;
}

export function DailyNewsletter(props: DailyNewsletterProps) {
  const { issueTitle, categoryLabel, publishDate, qaPairs, ctaUrl, unsubscribeUrl, previewText } =
    props;
  const publishDateObj = new Date(publishDate);
  const displayDate = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(publishDateObj);
  const safePairs = qaPairs.slice(0, 5);

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.kicker}>Dev Letter Daily</Text>
          <Heading style={styles.heading}>{issueTitle}</Heading>
          <Text style={styles.meta}>
            {displayDate} • {categoryLabel}
          </Text>

          <Section style={styles.qaSection}>
            {safePairs.map((pair, index) => (
              <div key={index} style={styles.qaCard}>
                <Text style={styles.qaIndex}>Q{index + 1}</Text>
                <Text style={styles.question}>{pair.question}</Text>
                <Text style={styles.answer}>{pair.answer}</Text>
              </div>
            ))}
          </Section>

          <Section style={styles.ctaSection}>
            <Text style={styles.ctaCopy}>
              더 깊이 있는 AI 인터뷰 질문과 국내 테크 레터 트렌드를 계속 확인해 보세요.
            </Text>
            <Button href={ctaUrl} style={styles.ctaButton}>
              대화형 데모 살펴보기
            </Button>
          </Section>

          <Hr style={styles.hr} />

          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              이 뉴스레터는 관심 카테고리를 기반으로 자동 생성되었습니다.
            </Text>
            <Text style={styles.footerText}>
              더 이상 소식을 받고 싶지 않다면{" "}
              <Link href={unsubscribeUrl} style={styles.unsubscribeLink}>
                구독을 취소해 주세요
              </Link>
              .
            </Text>
            <Text style={styles.footerCredit}>© {new Date().getFullYear()} Dev Letter</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default DailyNewsletter;

const styles = {
  body: {
    backgroundColor: "#020617",
    color: "#e2e8f0",
    fontFamily:
      '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
    margin: 0,
    padding: "32px 0",
  },
  container: {
    margin: "0 auto",
    padding: "32px 40px 40px",
    maxWidth: "640px",
    borderRadius: "16px",
    backgroundColor: "#0f172a",
  },
  kicker: {
    fontSize: "12px",
    letterSpacing: "0.3em",
    textTransform: "uppercase" as const,
    color: "#22d3ee",
  },
  heading: {
    fontSize: "32px",
    color: "#fff",
    margin: "12px 0 4px",
  },
  meta: {
    color: "#94a3b8",
    fontSize: "16px",
    margin: "0 0 24px",
  },
  qaSection: {
    marginTop: "32px",
  },
  qaCard: {
    border: "1px solid #1e293b",
    borderRadius: "12px",
    backgroundColor: "#0b1220",
    padding: "18px 20px",
    marginBottom: "20px",
  },
  qaIndex: {
    fontSize: "11px",
    letterSpacing: "0.25em",
    textTransform: "uppercase" as const,
    color: "#2dd4bf",
    margin: 0,
  },
  question: {
    margin: "10px 0 6px",
    fontSize: "18px",
    lineHeight: "1.5",
    color: "#f8fafc",
    fontWeight: 600,
  },
  answer: {
    margin: 0,
    fontSize: "15px",
    lineHeight: "1.6",
    color: "#cbd5f5",
  },
  ctaSection: {
    textAlign: "center" as const,
    marginTop: "32px",
  },
  ctaCopy: {
    fontSize: "15px",
    color: "#cbd5f5",
  },
  ctaButton: {
    display: "inline-block",
    marginTop: "16px",
    padding: "12px 28px",
    borderRadius: "999px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.12em",
    backgroundColor: "#22d3ee",
    color: "#0f172a",
    fontWeight: 700,
    border: "none",
  },
  hr: {
    borderColor: "#1f2937",
    margin: "32px 0",
  },
  footer: {
    textAlign: "center" as const,
  },
  footerText: {
    fontSize: "12px",
    color: "#94a3b8",
    margin: "6px 0",
  },
  footerCredit: {
    marginTop: "10px",
    fontSize: "11px",
    color: "#475569",
  },
  unsubscribeLink: {
    color: "#22d3ee",
    textDecoration: "underline",
  },
};
