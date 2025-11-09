import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Heading,
  Link,
  Hr,
  Section,
} from "@react-email/components";
import * as React from "react";

interface SubscriptionConfirmationProps {
  email: string;
  interests: string[];
  manageUrl: string;
  contactUrl: string;
}

export default function SubscriptionConfirmation({
  email,
  interests,
  manageUrl,
  contactUrl,
}: SubscriptionConfirmationProps) {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>구독해주셔서 감사합니다!</Heading>
          <Text style={paragraph}>
            안녕하세요, <strong style={emailText}>{email}</strong>님!
          </Text>
          <Text style={paragraph}>AI-Powered Developer Insights 뉴스레터 구독을 환영합니다.</Text>
          <Text style={paragraph}>선택하신 관심 분야는 다음과 같습니다:</Text>
          <Section style={interestsSection}>
            {interests.map((interest, index) => (
              <Text key={index} style={interestItem}>
                • {interest}
              </Text>
            ))}
          </Section>
          <Text style={paragraph}>
            앞으로{" "}
            <strong style={highlightText}>
              AI가 생성하는 최신 개발 트렌드, 심층 분석, 그리고 유용한 커리어 팁
            </strong>
            을 정기적으로 보내드리겠습니다.
          </Text>
          <Text style={paragraph}>궁금한 점이 있으시면 언제든지 회신해주세요.</Text>
          <Hr style={hr} />
          <Text style={footer}>
            이 이메일은 AI-Powered Developer Insights 뉴스레터 구독을 신청하신 분께 발송되었습니다.
          </Text>
          <Text style={footer}>
            <Link href={manageUrl} style={link}>
              구독 관리
            </Link>{" "}
            |{" "}
            <Link href={contactUrl} style={link}>
              문의하기
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#0f172a", // slate-900
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  margin: "0 auto",
  padding: "20px 0 48px",
  width: "580px",
  backgroundColor: "#1e293b", // slate-800
  borderRadius: "8px",
  color: "#e2e8f0", // slate-200
};

const h1 = {
  color: "#22d3ee", // cyan-400
  fontSize: "32px",
  fontWeight: "bold",
  textAlign: "center" as const,
  margin: "30px 0",
};

const paragraph = {
  fontSize: "16px",
  lineHeight: "26px",
  textAlign: "left" as const,
  padding: "0 40px",
};

const emailText = {
  color: "#a78bfa", // purple-400
  fontWeight: "bold",
};

const highlightText = {
  color: "#22d3ee", // cyan-400
  fontWeight: "bold",
};

const interestsSection = {
  padding: "0 40px",
  marginBottom: "20px",
};

const interestItem = {
  fontSize: "15px",
  lineHeight: "24px",
  color: "#94a3b8", // slate-400
};

const hr = {
  borderColor: "#334155", // slate-700
  margin: "20px 40px",
};

const footer = {
  color: "#64748b", // slate-500
  fontSize: "12px",
  textAlign: "center" as const,
  marginTop: "20px",
};

const link = {
  color: "#22d3ee", // cyan-400
  textDecoration: "underline",
};
