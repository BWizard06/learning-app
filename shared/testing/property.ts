export const DEFAULT_PROPERTY_RUNS = 10000

export function propertyRuns(fallback = DEFAULT_PROPERTY_RUNS): number {
  const raw = process.env.PROPERTY_RUNS
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
