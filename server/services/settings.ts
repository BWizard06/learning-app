import { eq } from 'drizzle-orm'
import { settings } from '../db/schema'
import type { Db } from './types'

const DIFFICULTY_PREFIX = 'difficulty.'

export function readSetting(db: Db, key: string): string | null {
  return db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).get()?.value ?? null
}

export function writeSetting(db: Db, key: string, value: string): void {
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run()
}

export function readAllSettings(db: Db): Record<string, string> {
  const rows = db.select().from(settings).all()
  return Object.fromEntries(rows.map((row) => [row.key, row.value]))
}

export function difficultyKey(gameSlug: string): string {
  return `${DIFFICULTY_PREFIX}${gameSlug}`
}

export function readDifficulty(db: Db, gameSlug: string, fallback: number): number {
  const raw = readSetting(db, difficultyKey(gameSlug))
  if (raw === null) return fallback
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function writeDifficulty(db: Db, gameSlug: string, value: number): void {
  if (!Number.isFinite(value)) return
  writeSetting(db, difficultyKey(gameSlug), String(Math.round(value * 100) / 100))
}

export function readAllDifficulties(db: Db): Record<string, number> {
  const all = readAllSettings(db)
  const result: Record<string, number> = {}
  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith(DIFFICULTY_PREFIX)) continue
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) result[key.slice(DIFFICULTY_PREFIX.length)] = parsed
  }
  return result
}
