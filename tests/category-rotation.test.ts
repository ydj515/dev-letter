import assert from "node:assert/strict";
import test from "node:test";
import { INTEREST_CATEGORIES } from "../src/constants";
import { getDailyCategorySchedule } from "../src/lib/category-rotation";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

test("cycles through each interest category sequentially", () => {
  const start = new Date("2025-11-09T00:00:00Z");
  const totalDays = INTEREST_CATEGORIES.length * 2;

  for (let day = 0; day < totalDays; day += 1) {
    const date = new Date(start.getTime() + day * MS_PER_DAY);
    const schedule = getDailyCategorySchedule(date);
    const expectedIndex = day % INTEREST_CATEGORIES.length;
    assert.equal(schedule.label, INTEREST_CATEGORIES[expectedIndex]);
    assert.equal(schedule.rotationIndex, expectedIndex);
  }
});

test("supports custom cycle anchors", () => {
  const anchor = new Date("2024-06-01T00:00:00Z");
  const schedule = getDailyCategorySchedule(anchor, { cycleStartDate: anchor });
  assert.equal(schedule.rotationIndex, 0);
  assert.equal(schedule.publishDate.getHours(), 0);

  const previousDay = new Date(anchor.getTime() - MS_PER_DAY);
  const wrapSchedule = getDailyCategorySchedule(previousDay, { cycleStartDate: anchor });
  const expectedIndex = INTEREST_CATEGORIES.length - 1;
  assert.equal(wrapSchedule.rotationIndex, expectedIndex);
  assert.equal(wrapSchedule.label, INTEREST_CATEGORIES[expectedIndex]);
});
