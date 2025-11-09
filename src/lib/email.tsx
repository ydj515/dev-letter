import { render } from "@react-email/render";
import DailyNewsletter, { type DailyNewsletterProps } from "../emails/DailyNewsletter";
import type { QAPair } from "./qa";

export interface RenderNewsletterInput {
  issueTitle: string;
  categoryLabel: string;
  publishDate: Date;
  qaPairs: QAPair[];
  ctaUrl: string;
  unsubscribeUrl: string;
}

export interface RenderNewsletterResult {
  html: string;
  text: string;
  previewText: string;
  subject: string;
}

export async function renderDailyNewsletterEmail(
  input: RenderNewsletterInput,
): Promise<RenderNewsletterResult> {
  const previewText = buildPreviewText(input.qaPairs, input.categoryLabel);
  const props: DailyNewsletterProps = {
    issueTitle: input.issueTitle,
    categoryLabel: input.categoryLabel,
    publishDate: input.publishDate.toISOString(),
    qaPairs: input.qaPairs,
    ctaUrl: input.ctaUrl,
    unsubscribeUrl: input.unsubscribeUrl,
    previewText,
  };

  const html = await render(<DailyNewsletter {...props} />);
  const text = await render(<DailyNewsletter {...props} />, { plainText: true });

  return {
    html,
    text,
    subject: input.issueTitle,
    previewText,
  };
}

function buildPreviewText(pairs: QAPair[], categoryLabel: string) {
  if (pairs.length === 0) {
    return `${categoryLabel} 인사이트를 확인해 보세요`;
  }
  const [first] = pairs;
  const snippet = first.answer.replace(/\s+/g, " ").slice(0, 80).trim();
  return `${first.question} — ${snippet}`;
}
