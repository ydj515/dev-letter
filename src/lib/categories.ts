import { InterestCategory } from "@prisma/client";
import { INTEREST_CATEGORIES } from "../constants";
import { PROMPT_TEMPLATES } from "./prompt-templates";

const LABEL_TO_CATEGORY = new Map<string, InterestCategory>();
const CATEGORY_TO_LABEL = new Map<InterestCategory, string>();

for (const label of INTEREST_CATEGORIES) {
  const category = resolveInterestCategory(label);
  LABEL_TO_CATEGORY.set(label, category);
  if (!CATEGORY_TO_LABEL.has(category)) {
    CATEGORY_TO_LABEL.set(category, label);
  }
}

function resolveInterestCategory(label: string): InterestCategory {
  const enumKey = label.replace(/[^\w]+/g, "_");
  const category = InterestCategory[enumKey as keyof typeof InterestCategory];
  if (!category) {
    throw new Error(`Unknown interest category label "${label}"`);
  }
  return category;
}

export function toInterestCategory(label: string) {
  const category = LABEL_TO_CATEGORY.get(label);
  if (!category) {
    return resolveInterestCategory(label);
  }
  return category;
}

export function getCategoryLabel(category: InterestCategory) {
  const label = CATEGORY_TO_LABEL.get(category);
  if (label) return label;
  const template = PROMPT_TEMPLATES[category];
  if (template) return template.label;
  return category;
}

export function listCategoryRotation() {
  return INTEREST_CATEGORIES.map((label) => ({
    label,
    category: toInterestCategory(label),
  }));
}
