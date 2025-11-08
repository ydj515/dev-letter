export function startOfDay(date = new Date()) {
  const clone = new Date(date);
  clone.setHours(0, 0, 0, 0);
  return clone;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
