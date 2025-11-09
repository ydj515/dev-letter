import { InterestCategory } from "@prisma/client";

type Tone = "실무형" | "위기대응" | "전략" | "실험" | "최적화";

export interface PromptTemplate {
  category: InterestCategory;
  label: string;
  questionCount: number;
  tone: Tone;
  temperature: number;
  focus: string;
  guidelines: string[];
  format: string;
}

const DEFAULT_TEMPLATE = {
  questionCount: 5,
  tone: "실무형" as Tone,
  temperature: 0.45,
  format: [
    "OUTPUT FORMAT STRICTLY:",
    '1. JSON 배열만 출력: [{"question": "...?", "answer": "..."}]',
    "2. question: 1문장, 200자 이하, 반드시 ?로 종료",
    "3. answer: 2~3문장, 최대 600자, 실무 경험과 수치/전략 포함",
    "4. JSON 외 다른 텍스트, Markdown, 주석 금지",
  ].join("\n"),
  guidelines: [
    "사건/장애/프로덕션 이슈와 관련된 의사결정을 묻는다.",
    "기술 선택의 트레이드오프, 모니터링 전략, 성능 개선 방식을 포함한다.",
    "사내 고유 명사나 특정 기업 이름은 언급하지 않는다.",
  ],
};

export const PROMPT_TEMPLATES: Record<InterestCategory, PromptTemplate> = {
  [InterestCategory.Backend]: {
    ...DEFAULT_TEMPLATE,
    category: InterestCategory.Backend,
    label: "Backend",
    focus: "대규모 분산 시스템, 트래픽 급증 대응, 장애 복구 전략",
    guidelines: [
      ...DEFAULT_TEMPLATE.guidelines,
      "데이터 일관성, 스케일링(수평/수직) 전환 사례를 포함한다.",
    ],
  },
  [InterestCategory.Database]: {
    ...DEFAULT_TEMPLATE,
    category: InterestCategory.Database,
    label: "Database",
    tone: "최적화",
    focus: "데이터 모델링, 쿼리 튜닝, 복제/샤딩, 장애 대비 전략",
    guidelines: [
      ...DEFAULT_TEMPLATE.guidelines,
      "트랜잭션 격리 수준, 백업/복구, 옵저버빌리티 관련 질문을 포함한다.",
    ],
  },
  [InterestCategory.Network]: {
    ...DEFAULT_TEMPLATE,
    category: InterestCategory.Network,
    label: "Network",
    tone: "위기대응",
    focus: "멀티 리전 네트워크 설계, CDN, 보안 사고 대응",
    guidelines: [
      ...DEFAULT_TEMPLATE.guidelines,
      "DDoS, TLS, 라우팅 관련 성능/안정성 질문을 섞는다.",
    ],
  },
  [InterestCategory.Java]: {
    ...DEFAULT_TEMPLATE,
    category: InterestCategory.Java,
    label: "Java",
    focus: "JVM 튜닝, 모듈러 아키텍처, GC 전략, 레거시 마이그레이션",
    guidelines: [
      ...DEFAULT_TEMPLATE.guidelines,
      "실제 JVM 옵션 조정, 스레드 관리, 성능 검증 사례를 묻는다.",
    ],
  },
  [InterestCategory.Spring]: {
    ...DEFAULT_TEMPLATE,
    category: InterestCategory.Spring,
    label: "Spring",
    tone: "전략",
    focus: "Spring Boot 3, MVC 스택, Reactive 스택, 보안/관측성, 모듈 경계",
    guidelines: [
      ...DEFAULT_TEMPLATE.guidelines,
      "AOP, Data, Cloud, Batch 등 서브프로젝트 선택 기준을 포함한다.",
    ],
  },
  [InterestCategory.DevOps]: {
    ...DEFAULT_TEMPLATE,
    category: InterestCategory.DevOps,
    label: "DevOps",
    tone: "실험",
    temperature: 0.55,
    focus: "CI/CD 최적화, IaC, 옵저버빌리티, 릴리스 전략",
    guidelines: [
      ...DEFAULT_TEMPLATE.guidelines,
      "릴리스 게이트, 플래그, 롤백, 플랫폼 엔지니어링 요소를 묻는다.",
    ],
  },
  [InterestCategory.Frontend]: {
    ...DEFAULT_TEMPLATE,
    category: InterestCategory.Frontend,
    label: "Frontend",
    tone: "실무형",
    focus: "대규모 SPA/MPA 성능, 접근성, DX, 번들 전략",
    guidelines: [
      ...DEFAULT_TEMPLATE.guidelines,
      "성능 예산, 번들 스플리팅, 디자인 시스템 운영 관련 질문을 포함한다.",
    ],
  },
  [InterestCategory.AI_ML]: {
    ...DEFAULT_TEMPLATE,
    category: InterestCategory.AI_ML,
    label: "AI/ML",
    tone: "전략",
    temperature: 0.6,
    focus: "모델 운영(MLOps), 데이터 거버넌스, 프롬프트 엔지니어링",
    guidelines: [
      ...DEFAULT_TEMPLATE.guidelines,
      "LLM 안전성, 비용 통제, 오케스트레이션 전략(예: RAG)을 포함한다.",
    ],
  },
};

export function buildPrompt(category: InterestCategory) {
  const template = PROMPT_TEMPLATES[category];
  const header = [
    `You are an expert interviewer for ${template.label} engineering leads.`,
    `Tone: ${template.tone} / Focus: ${template.focus}.`,
    `Generate ${template.questionCount} senior-level interview question & answer pairs in Korean.`,
    "Each pair must include a question and a concise model answer describing desired reasoning.",
  ].join(" ");

  const body = template.guidelines.map((guideline) => `- ${guideline}`).join("\n");

  return `${header}\n${body}\n\n${template.format}`;
}
