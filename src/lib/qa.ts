import { clamp } from "./utils";

const LIST_MARKER = /^[\s>*-]*((\d+[\.\)])|[-*])\s*/;
const QUOTE_WRAPPER = /^["“”'`]+|["“”'`]+$/g;
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
  const cleaned = value.trim();
  const [questionPart, ...rest] = cleaned.split(/(?:A[:\-]|답변[:\-])/i);
  const question = questionPart.replace(/^Q[:\-]/i, "").trim();
  const answer = rest.join(" ").trim();
  return { question, answer };
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
        "장애 감지 시점을 어떻게 앞당겼는지, 장애 범위를 줄이기 위해 어떤 롤백/트래픽 셰이핑 전략을 사용했는지 구체적으로 공유해 주세요.",
    },
    {
      question: `${categoryLabel} 영역에서 서비스 품질(SLO/SLA)을 지키기 위해 도입한 모니터링/알림 체계를 소개해 주세요.`,
      answer:
        "어떤 지표를 핵심 신호로 사용하며, 알림 노이즈를 줄이기 위해 적용한 룰/자동화가 있다면 상세히 설명해 주세요.",
    },
    {
      question: `${categoryLabel} 관련 아키텍처 변경이나 기술 선택에서 고려한 트레이드오프를 예시와 함께 설명해 주세요.`,
      answer:
        "도입 전후 비교 지표, 이해관계자 설득 과정, 예상치 못한 리스크 등을 포함해 주시면 좋습니다.",
    },
    {
      question: `${categoryLabel} 분야의 기술 부채를 정리하기 위한 프로세스나 의사결정 방식을 공유해 주세요.`,
      answer:
        "우선순위 산정 기준, 정기적인 리팩토링/성능 개선 사이클, KPI 연계 방식 등을 알려주세요.",
    },
    {
      question: `${categoryLabel} 팀이 향후 6개월 동안 집중하고 싶은 ${categoryLabel} 트렌드나 실험 계획은 무엇인가요?`,
      answer:
        "현재 확보한 리소스, 실험 성공 기준, 리스크 완화 계획 등 실행 전략을 중심으로 설명해 주세요.",
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
