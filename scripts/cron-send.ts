#!/usr/bin/env node
import { runNewsletterCron } from "../src/services/newsletter-cron";
import { prisma } from "../src/lib/prisma";

interface CliOptions {
  date?: Date;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {};

  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, value] = arg.slice(2).split("=");
    if (key === "date" && value) {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        throw new Error(`Invalid --date value: "${value}"`);
      }
      options.date = parsed;
    }
  }

  return options;
}

async function main() {
  const cliOptions = parseArgs(process.argv.slice(2));
  const result = await runNewsletterCron({ date: cliOptions.date });

  console.log("=== Newsletter Cron Summary ===");
  console.log(
    `Publish date ${result.schedule.publishDate} • category=${result.schedule.label} (rotation #${result.schedule.rotationIndex})`,
  );
  console.log(
    `Issue ${result.issue.id} source=${result.issue.source} deliveries(created=${result.deliveries.deliveriesCreated}, skipped=${result.deliveries.alreadyQueued})`,
  );

  if (result.backlog.inspected > 0) {
    console.log(
      `Backlog inspected=${result.backlog.inspected}, requeued=${result.backlog.requeued}`,
    );
  }

  if (result.send.disabled) {
    console.log(`[Send] skipped because ${result.send.reason}`);
  } else {
    console.log(
      `[Send] batches=${result.send.batches} sent=${result.send.sent} failed=${result.send.failed} skipped=${result.send.skipped}`,
    );
  }
}

main()
  .catch((error) => {
    console.error("Cron run failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
