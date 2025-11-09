import { clamp } from "./utils";

const LIST_MARKER = /^[\s>*-]*((\d+[\.\)])|[-*])\s*/;
const QUOTE_WRAPPER = /^["“”'`]+|["“”'`]+$/g;
const QUESTION_PREFIX = /^(?:Q(?:uestion)?|질문)\s*\d*\s*[:\-.\)]\s*/i;
const ANSWER_PREFIX = /^(?:A(?:nswer)?|답변)\s*\d*\s*[:\-.\)]\s*/i;
const MAX_QUESTION_LENGTH = 220;
const MIN_QUESTION_LENGTH = 15;
const MAX_ANSWER_LENGTH = 600;
const MIN_ANSWER_LENGTH = 40;
const BANNED_TERMS = ["지원자", "이력서", "회사 소개"];

export interface QAPair {
  question: string;
  answer: string;
}

export interface NormalizeQaOptions {
  expectedCount: number;
  minCount?: number;
}

export function normalizeQaPairs(raw: string, options: NormalizeQaOptions) {
  const { expectedCount, minCount = Math.min(3, expectedCount) } = options;
  const parsed = parseStructuredPairs(raw);
  const unique = new Set<string>();
  const results: QAPair[] = [];

  for (const candidate of parsed) {
    const question = tidyQuestion(candidate.question ?? "");
    const answer = tidyAnswer(candidate.answer ?? "");

    if (!question || !answer) continue;

    if (BANNED_TERMS.some((term) => question.includes(term) || answer.includes(term))) {
      continue;
    }

    const key = `${question}::${answer}`;
    if (unique.has(key)) continue;
    unique.add(key);
    results.push({ question, answer });

    if (results.length === expectedCount) break;
  }

  if (results.length < minCount) {
    throw new Error(`Not enough valid QA pairs. expected=${expectedCount}, got=${results.length}`);
  }

  return results;
}

function parseStructuredPairs(raw: string) {
  const jsonPairs = parseJsonPairs(raw);
  if (jsonPairs.length > 0) {
    return jsonPairs;
  }

  return parseBlockPairs(raw);
}

function parseJsonPairs(raw: string) {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");

  if (start === -1 || end === -1 || end <= start) {
    return [];
  }

  try {
    const result = JSON.parse(raw.slice(start, end + 1));
    if (!Array.isArray(result)) return [];

    return result
      .map((entry) => {
        if (!entry) return null;

        if (Array.isArray(entry)) {
          const [question, answer] = entry;
          return { question: String(question ?? ""), answer: String(answer ?? "") };
        }

        if (typeof entry === "object") {
          const question = getString(entry, ["question", "q", "질문"]);
          const answer = getString(entry, ["answer", "a", "답변"]) ?? "";
          if (!question) return null;
          return { question, answer };
        }

        if (typeof entry === "string") {
          const { question, answer } = splitInline(entry);
          return { question, answer };
        }

        return null;
      })
      .filter(Boolean) as QAPair[];
  } catch {
    return [];
  }
}

function parseBlockPairs(raw: string) {
  const blocks = raw.split(/\n{2,}/).map((block) => block.trim());
  const pairs = [];

  for (const block of blocks) {
    if (!block) continue;
    const { question, answer } = splitInline(block);
    pairs.push({ question, answer });
  }

  return pairs;
}

function splitInline(value: string) {
  const cleaned = value.trim().replace(/^\*\*/g, "");

  const normalized = cleaned.replace(LIST_MARKER, "").trim();

  const answerSeparator = /(?:\bA(?:nswer)?|\b답변)\s*\d*\s*[:\-.\)]/i;
  const [questionPartRaw, ...restRaw] = normalized.split(answerSeparator);
  const questionPart = questionPartRaw ?? "";
  let answerPart = restRaw.join(" ").trim();

  if (!answerPart && normalized.includes("\n")) {
    const lines = normalized.split(/\n+/);
    const first = lines.shift() ?? "";
    answerPart = lines.join(" ").trim();
    return {
      question: stripQuestionPrefix(first),
      answer: stripAnswerPrefix(answerPart),
    };
  }

  return {
    question: stripQuestionPrefix(questionPart),
    answer: stripAnswerPrefix(answerPart),
  };
}

function stripQuestionPrefix(input: string) {
  let value = input.trim();
  value = value.replace(QUOTE_WRAPPER, "");
  value = value.replace(LIST_MARKER, "").trim();
  value = value.replace(QUESTION_PREFIX, "").trim();
  return value;
}

function stripAnswerPrefix(input: string) {
  let value = input.trim();
  value = value.replace(QUOTE_WRAPPER, "");
  value = value.replace(ANSWER_PREFIX, "").trim();
  return value;
}

function getString(entry: object, keys: string[]) {
  for (const key of keys) {
    const value = (entry as Record<string, unknown>)[key];
    if (typeof value === "string") {
      return value;
    }
  }
  return null;
}

function tidyQuestion(input: string) {
  let value = input.trim().replace(QUOTE_WRAPPER, "");
  value = value.replace(LIST_MARKER, "").trim();

  if (!value) return "";

  if (!value.endsWith("?")) {
    value = `${value}?`;
  }

  const length = clamp(value.length, MIN_QUESTION_LENGTH, MAX_QUESTION_LENGTH);
  if (value.length > MAX_QUESTION_LENGTH) {
    value = `${value.slice(0, length - 1).trim()}?`;
  }

  if (value.length < MIN_QUESTION_LENGTH) {
    return "";
  }

  return value;
}

function tidyAnswer(input: string) {
  let value = input.trim().replace(QUOTE_WRAPPER, "");

  if (value.startsWith("A:") || value.startsWith("a:")) {
    value = value.slice(2).trim();
  }

  if (!value) return "";

  if (!/[.!?]$/.test(value)) {
    value = `${value}.`;
  }

  if (value.length > MAX_ANSWER_LENGTH) {
    value = `${value.slice(0, MAX_ANSWER_LENGTH - 1).trim()}.`;
  }

  if (value.length < MIN_ANSWER_LENGTH) {
    return "";
  }

  return value;
}

export function buildFallbackQaPairs(categoryLabel: string, count: number): QAPair[] {
  const basePairs: QAPair[] = [
    {
      question: `${categoryLabel} 시스템에서 가장 최근에 겪은 장애 상황과 복구 전략을 설명해 주세요.`,
      answer:
        "지난 분기 새로 도입한 캐시 계층의 메모리 누수로 응답 지연이 4배까지 증가했습니다. 장애를 감지하자마자 읽기 전용 모드로 전환하고, 트래픽 절반을 구 인프라로 우회한 뒤 30분 내에 패치 버전을 배포했습니다. 동일 이슈 재발을 막기 위해 헬스 체크와 메모리 한도 알람을 추가로 설정했습니다.",
    },
    {
      question: `${categoryLabel} 영역에서 서비스 품질(SLO/SLA)을 지키기 위해 도입한 모니터링/알림 체계를 소개해 주세요.`,
      answer:
        "우리는 Latency P95, 에러율, Saturation 세 가지 지표를 핵심 신호로 삼고 있습니다. 알람 노이즈를 줄이기 위해 히스토리 기반의 동적 임계치를 사용하고, 동일 알람이 3회 이상 반복되면 자동으로 온콜 담당자에게 슬랙 알림과 함께 런북 링크를 전송하도록 설정했습니다.",
    },
    {
      question: `${categoryLabel} 관련 아키텍처 변경이나 기술 선택에서 고려한 트레이드오프를 예시와 함께 설명해 주세요.`,
      answer:
        "신규 분석 파이프라인을 구축할 때, 관리가 쉬운 SaaS 솔루션과 유연한 자체 구축형을 두고 비교했습니다. SaaS는 빠르게 도입 가능했지만 비용이 급증하는 문제가 있었고, 자체 구축은 초기 인력 투입이 많았으나 장기적으로 비용을 절감했습니다. 결국 자체 구축을 선택하고, 초기에 부족한 운영 인력을 보완하기 위해 일시적으로 외부 컨설턴트를 함께 투입했습니다.",
    },
    {
      question: `${categoryLabel} 분야의 기술 부채를 정리하기 위한 프로세스나 의사결정 방식을 공유해 주세요.`,
      answer:
        "기술 부채는 영향도 x 긴급도 매트릭스로 분류하여 분기마다 별도의 'Quality Sprint'를 확보합니다. 각 항목에는 해결 시 기대되는 KPI 개선 값을 붙이고, 제품 팀과 합의된 목표 대비 진행률을 위클리 리포트로 공유해 우선순위가 흔들리지 않도록 하고 있습니다.",
    },
    {
      question: `${categoryLabel} 팀이 향후 6개월 동안 집중하고 싶은 ${categoryLabel} 트렌드나 실험 계획은 무엇인가요?`,
      answer:
        "앞으로 6개월 동안은 서버리스 워크로드와 AI 보조 도구를 결합해 배포 효율을 높이는 실험을 진행합니다. 실험 성공 기준은 배포 준비 시간 30% 감축이며, 보안 사고를 막기 위해 모든 자동화 플로우에 승인 단계를 넣고 감사 로그를 남기도록 설계했습니다.",
    },
  ];

  if (count <= basePairs.length) {
    return basePairs.slice(0, count);
  }

  const extended: QAPair[] = [];
  while (extended.length + basePairs.length < count) {
    extended.push({
      question: `${categoryLabel} 업무에서 반복적으로 발생하는 리스크를 줄이기 위해 적용한 안전장치를 설명해 주세요.`,
      answer:
        "런북, 자동화, 가드레일 등 구체적인 장치를 나열하고, 실제로 리스크를 얼마나 줄였는지 수치/사례를 공유해 주세요.",
    });
  }

  return basePairs.concat(extended).slice(0, count);
}
