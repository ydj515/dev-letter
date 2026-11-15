import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { render } from "@react-email/render";
import SubscriptionConfirmation from "../src/emails/SubscriptionConfirmation";
import { renderDailyNewsletterEmail } from "../src/lib/email";

test("newsletter HTML escapes text and preserves text links", async () => {
  const result = await renderDailyNewsletterEmail({
    issueTitle: "Fixture <script>unsafe</script>",
    categoryLabel: "Backend",
    publishDate: new Date("2026-01-01"),
    qaPairs: [{ question: "A & B?", answer: "<img src=x onerror=alert(1)>" }],
    ctaUrl: "https://example.test/newsletter",
    unsubscribeUrl: "https://example.test/unsubscribe",
  });
  assert(!result.html.includes("<script>"));
  assert(!result.html.includes("<img src=x"));
  assert(result.html.includes("&lt;script&gt;"));
  assert(result.text.includes("A & B?"));
  assert(result.text.includes("https://example.test/unsubscribe"));
});

test("subscription confirmation renders HTML and plain text", async () => {
  const element = createElement(SubscriptionConfirmation, {
    email: "fixture@example.test",
    interests: ["Backend"],
    manageUrl: "https://example.test/manage",
    contactUrl: "https://example.test/contact",
  });
  const html = await render(element);
  const text = await render(element, { plainText: true });
  assert(html.includes("fixture@example.test"));
  assert(text.includes("fixture@example.test"));
  assert(text.includes("https://example.test/manage"));
});
