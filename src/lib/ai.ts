import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
  costUsd?: number;
}

export interface AiGenerateOptions {
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
}

export interface AiResult {
  text: string;
  usage?: AiUsage;
}

export interface AiClient {
  generateText(prompt: string, options?: AiGenerateOptions): Promise<AiResult>;
}

const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
const MODEL_PRICING = {
  "gemini-2.0-flash": {
    input: 0.35 / 1_000_000,
    output: 1.05 / 1_000_000,
  },
} as const;
const MODEL_PRICING_FALLBACK = MODEL_PRICING["gemini-2.0-flash"];
const PRICING = MODEL_PRICING[DEFAULT_MODEL as keyof typeof MODEL_PRICING] ?? MODEL_PRICING_FALLBACK;

export class GeminiClient implements AiClient {
  private model: GenerativeModel | null = null;

  constructor(private readonly maxRetries = 2) {}

  async generateText(prompt: string, options: AiGenerateOptions = {}) {
    const { temperature = 0.4, maxOutputTokens = 512, timeoutMs = 15_000, metadata } = options;

    const model = this.getModel();

    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxRetries + 1; attempt += 1) {
      try {
        const start = Date.now();
        const result = await runWithTimeout(
          () =>
            model.generateContent({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: {
                temperature,
                maxOutputTokens,
              },
            }),
          timeoutMs,
        );
        const latencyMs = Date.now() - start;

        const text = result.response.text();
        const usage = mapUsage(result.response.usageMetadata, latencyMs);

        logUsage(usage, metadata);

        return { text, usage };
      } catch (error) {
        lastError = error;
        const shouldRetry = attempt <= this.maxRetries && isRetryable(error);

        if (!shouldRetry) {
          throw error;
        }

        await wait(exponentialBackoff(attempt));
      }
    }

    throw lastError ?? new Error("Unknown Gemini failure");
  }

  private getModel() {
    if (this.model) return this.model;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const sdk = new GoogleGenerativeAI(apiKey);
    this.model = sdk.getGenerativeModel({ model: DEFAULT_MODEL });
    return this.model;
  }
}

type UsageMetadata = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
};

function mapUsage(usage: UsageMetadata | null | undefined, latencyMs: number): AiUsage | undefined {
  if (!usage) return undefined;

  const inputTokens = usage.promptTokenCount ?? 0;
  const outputTokens = usage.candidatesTokenCount ?? 0;
  const totalTokens = usage.totalTokenCount ?? inputTokens + outputTokens;
  const costUsd = inputTokens * PRICING.input + outputTokens * PRICING.output;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    latencyMs,
    costUsd: Number(costUsd.toFixed(6)),
  };
}

function logUsage(usage: AiUsage | undefined, metadata?: Record<string, unknown>) {
  if (!usage) return;
  const prefix = metadata ? `[Gemini:${JSON.stringify(metadata)}]` : "[Gemini]";
  console.info(
    `${prefix} tokens(in:${usage.inputTokens}, out:${usage.outputTokens}) cost=$${usage.costUsd ?? 0} latency=${usage.latencyMs}ms`,
  );
}

type HttpError = Error & { status?: number };

function isRetryable(error: unknown) {
  if (!(error instanceof Error)) return false;
  if (hasHttpStatus(error)) {
    const status = error.status as number;
    return status >= 500 || status === 429;
  }
  const message = error.message ?? "";
  return /timeout|unavailable|aborted|fetch failed/i.test(message);
}

function hasHttpStatus(error: Error | HttpError): error is HttpError {
  return typeof (error as HttpError).status === "number";
}

async function runWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number) {
  if (timeoutMs <= 0) return fn();

  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Gemini request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([fn(), timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function exponentialBackoff(attempt: number) {
  const base = 300;
  return base * 2 ** (attempt - 1);
}

export const geminiClient = new GeminiClient();
