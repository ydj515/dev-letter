import { InterestCategory } from "@prisma/client";
import { listCategoryRotation } from "./categories";
import { startOfDay } from "./utils";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_CYCLE_START = startOfDay(new Date("2025-11-09"));
const ROTATION = listCategoryRotation();

export interface DailyCategorySchedule {
  publishDate: Date;
  cycleStartDate: Date;
  rotationIndex: number;
  offsetDays: number;
  category: InterestCategory;
  label: string;
}

export interface CategoryScheduleOptions {
  cycleStartDate?: Date;
}

export function getDailyCategorySchedule(
  date = new Date(),
  options: CategoryScheduleOptions = {},
): DailyCategorySchedule {
  if (ROTATION.length === 0) {
    throw new Error("No interest categories configured");
  }

  const publishDate = startOfDay(date);
  const cycleStart =
    options.cycleStartDate !== undefined ? startOfDay(options.cycleStartDate) : DEFAULT_CYCLE_START;
  const diffMs = publishDate.getTime() - cycleStart.getTime();
  const offsetDays = Math.trunc(diffMs / MS_PER_DAY);
  const rotationIndex = mod(offsetDays, ROTATION.length);
  const entry = ROTATION[rotationIndex];

  return {
    publishDate,
    cycleStartDate: cycleStart,
    rotationIndex,
    offsetDays,
    category: entry.category,
    label: entry.label,
  };
}

function mod(value: number, divisor: number) {
  const remainder = value % divisor;
  return remainder >= 0 ? remainder : remainder + divisor;
}
