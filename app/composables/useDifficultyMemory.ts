const PREFIX = 'learning-app.difficulty.'

export function readDifficulty(slug: string, fallback: number): number {
  if (typeof localStorage === 'undefined') return fallback
  const raw = localStorage.getItem(PREFIX + slug)
  if (!raw) return fallback
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function writeDifficulty(slug: string, value: number): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(PREFIX + slug, String(value))
}
