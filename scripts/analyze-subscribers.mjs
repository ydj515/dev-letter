#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Keep this list in sync with src/constants/index.ts
const CATEGORIES = [
  "Backend",
  "Database",
  "Network",
  "Java",
  "Spring",
  "DevOps",
  "Frontend",
  "AI/ML",
];

function increment(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function sortEntriesByValue(map) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

async function main() {
  const subscribers = await prisma.subscriber.findMany();
  const total = subscribers.length;

  const categoryCounts = new Map(CATEGORIES.map((cat) => [cat, 0]));
  const invalidInterests = new Map();
  const comboCounts = new Map();
  let emptyInterestCount = 0;

  for (const subscriber of subscribers) {
    const { interests } = subscriber;

    if (!interests || interests.length === 0) {
      emptyInterestCount += 1;
      continue;
    }

    const seenForSubscriber = new Set();

    for (const interest of interests) {
      if (CATEGORIES.includes(interest)) {
        if (!seenForSubscriber.has(interest)) {
          categoryCounts.set(interest, (categoryCounts.get(interest) || 0) + 1);
          seenForSubscriber.add(interest);
        }
      } else {
        increment(invalidInterests, interest);
      }
    }

    const comboKey = [...seenForSubscriber].sort().join(", ") || "(none)";
    increment(comboCounts, comboKey);
  }

  console.log("=== Subscriber Summary ===");
  console.log(`Total subscribers: ${total}`);
  console.log(`No interests selected: ${emptyInterestCount}`);
  console.log("");

  console.log("Category coverage (unique subscribers per interest):");
  console.table(
    [...categoryCounts.entries()].map(([category, count]) => ({
      category,
      subscribers: count,
      coverage: total > 0 ? `${((count / total) * 100).toFixed(1)}%` : "0%",
    })),
  );

  if (comboCounts.size > 0) {
    console.log("Top interest combinations:");
    console.table(
      sortEntriesByValue(comboCounts)
        .slice(0, 10)
        .map(([combo, count]) => ({
          combo,
          subscribers: count,
          share: total > 0 ? `${((count / total) * 100).toFixed(1)}%` : "0%",
        })),
    );
  }

  if (invalidInterests.size > 0) {
    console.log("Invalid interests detected:");
    console.table(
      sortEntriesByValue(invalidInterests).map(([interest, count]) => ({ interest, count })),
    );
  } else {
    console.log("No invalid interests detected.");
  }
}

main()
  .catch((error) => {
    console.error("Failed to analyze subscribers:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
