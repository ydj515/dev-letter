import {
  InterestCategory,
  IssueStatus,
  Prisma,
  type NewsletterIssue,
  type PrismaClient,
} from "@prisma/client";
import { geminiClient, type AiClient } from "../lib/ai";
import { PROMPT_TEMPLATES, buildPrompt } from "../lib/prompt-templates";
import { buildFallbackQaPairs, normalizeQaPairs } from "../lib/qa";
import { prisma as defaultPrisma } from "../lib/prisma";
import { startOfDay } from "../lib/utils";

export type IssueCreationSource = "existing" | "ai" | "fallback";

type NewsletterIssueRepository = Pick<PrismaClient, "newsletterIssue">;

const ESTIMATED_TOKENS_PER_QA_PAIR = 120;

export interface CreateNewsletterIssueOptions {
  category: InterestCategory;
  publishDate?: Date;
  prisma?: NewsletterIssueRepository;
  aiClient?: AiClient;
}

export interface CreateNewsletterIssueResult {
  issue: NewsletterIssue;
  source: IssueCreationSource;
}

export async function createNewsletterIssue(
  options: CreateNewsletterIssueOptions,
): Promise<CreateNewsletterIssueResult> {
  const { category, prisma = defaultPrisma, aiClient = geminiClient } = options;
  const publishDate = startOfDay(options.publishDate);
  const template = PROMPT_TEMPLATES[category];

  if (!template) {
    throw new Error(`Unsupported category: ${category}`);
  }

  const existing = await prisma.newsletterIssue.findUnique({
    where: {
      category_publishDate: {
        category,
        publishDate,
      },
    },
  });

  if (existing) {
    return { issue: existing, source: "existing" };
  }

  const prompt = buildPrompt(category);
  let qaPairs: ReturnType<typeof buildFallbackQaPairs> | null = null;
  let source: IssueCreationSource = "fallback";

  try {
    const aiResult = await aiClient.generateText(prompt, {
      temperature: template.temperature,
      maxOutputTokens: template.questionCount * ESTIMATED_TOKENS_PER_QA_PAIR,
      metadata: {
        category,
        publishDate: publishDate.toISOString(),
      },
    });

    qaPairs = normalizeQaPairs(aiResult.text, {
      expectedCount: template.questionCount,
    });
    source = "ai";
  } catch (error) {
    console.warn(`[NewsletterIssue] AI generation failed for ${category}:`, error);
  }

  if (!qaPairs) {
    qaPairs = buildFallbackQaPairs(template.label, template.questionCount);
    source = "fallback";
  }

  try {
    const qaPairsJson = qaPairs as unknown as Prisma.JsonArray;
    const issue = await prisma.newsletterIssue.create({
      data: {
        category,
        publishDate,
        title: `Dev Letter Daily • ${template.label}`,
        qaPairs: qaPairsJson,
        status: IssueStatus.DRAFT,
        generatedAt: new Date(),
        scheduledFor: publishDate,
      },
    });

    return { issue, source };
  } catch (error) {
    if (isUniqueConstraint(error)) {
      const conflict = await prisma.newsletterIssue.findUnique({
        where: {
          category_publishDate: {
            category,
            publishDate,
          },
        },
      });

      if (conflict) {
        return { issue: conflict, source: "existing" };
      }
    }

    throw error;
  }
}

function isUniqueConstraint(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
