const PREFIX = 'learning-app.difficulty.'

let serverSnapshot: Record<string, number> | null = null
let inFlight: Promise<Record<string, number>> | null = null

export function readLocalDifficulty(slug: string, fallback: number): number {
  if (typeof localStorage === 'undefined') return fallback
  const raw = localStorage.getItem(PREFIX + slug)
  if (!raw) return fallback
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function writeDifficulty(slug: string, value: number): void {
  if (typeof localStorage === 'undefined' || !Number.isFinite(value)) return
  localStorage.setItem(PREFIX + slug, String(Math.round(value * 100) / 100))
  if (serverSnapshot) serverSnapshot[slug] = value
}

export async function loadServerDifficulties(): Promise<Record<string, number>> {
  if (serverSnapshot) return serverSnapshot
  if (!inFlight) {
    inFlight = $fetch<{ difficulties: Record<string, number> }>('/api/settings')
      .then((response) => {
        serverSnapshot = response.difficulties ?? {}
        return serverSnapshot
      })
      .catch(() => ({}) as Record<string, number>)
      .finally(() => {
        inFlight = null
      })
  }
  return inFlight
}

export async function readDifficulty(slug: string, fallback: number): Promise<number> {
  const local = readLocalDifficulty(slug, Number.NaN)
  const remote = (await loadServerDifficulties())[slug]

  if (Number.isFinite(remote)) return remote!
  if (Number.isFinite(local)) return local
  return fallback
}
