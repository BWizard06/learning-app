import { desc, eq } from 'drizzle-orm'
import { createRng, type Rng } from '../../shared/rng'
import { daysBetween, localDate } from '../../shared/dates'
import { mean, round } from '../../shared/series'
import { CONSTRUCT_LABELS, type Construct } from '../../shared/types'
import { games as catalog, gameBySlug } from '../../app/games/index'
import { planDays, sessions } from '../db/schema'
import type { Db } from './types'

export const MIN_GAMES = 4
export const MAX_GAMES = 6
export const TARGET_MINUTES = 13
export const MAX_KONZENTRATION = 2
export const ROTATION_DAYS = 10
export const RECENT_FOR_NOTE = 5

export interface PlanCandidate {
  slug: string
  construct: Construct
  minutes: number
  note: number | null
  daysSincePlayed: number | null
}

export interface PlanEntry {
  slug: string
  name: string
  construct: Construct
  constructLabel: string
  minutes: number
  reason: string
}

export interface DayPlan {
  date: string
  entries: PlanEntry[]
  minutes: number
  completed: string[]
}

function weaknessScore(note: number | null): number {
  if (note === null) return 2.5
  return Math.min(3, Math.max(0, 4 - note)) * 1.2
}

function stalenessScore(days: number | null): number {
  if (days === null) return 3.5
  return Math.min(14, days) * 0.25
}

function reasonFor(candidate: PlanCandidate): string {
  if (candidate.daysSincePlayed === null) return 'noch nie gespielt'
  if (candidate.daysSincePlayed >= ROTATION_DAYS) return `seit ${candidate.daysSincePlayed} Tagen nicht dran`
  if (candidate.note !== null && candidate.note < 4) return 'Konstrukt unter der Bestehensgrenze'
  if (candidate.note === null) return 'noch keine Note'
  return 'hält den Katalog in Bewegung'
}

export function selectPlan(candidates: readonly PlanCandidate[], rng: Rng): PlanCandidate[] {
  const jittered = candidates.map((candidate) => ({
    candidate,
    priority:
      weaknessScore(candidate.note) +
      stalenessScore(candidate.daysSincePlayed) +
      (candidate.daysSincePlayed !== null && candidate.daysSincePlayed >= ROTATION_DAYS ? 6 : 0) +
      rng.float(0, 0.4),
  }))

  jittered.sort((a, b) => b.priority - a.priority)

  const chosen: PlanCandidate[] = []
  const usedSlugs = new Set<string>()
  let konzentration = 0
  let minutes = 0

  for (const entry of jittered) {
    if (chosen.length >= MAX_GAMES) break
    if (usedSlugs.has(entry.candidate.slug)) continue
    if (entry.candidate.construct === 'konzentration' && konzentration >= MAX_KONZENTRATION) continue
    if (chosen.length >= MIN_GAMES && minutes >= TARGET_MINUTES) break

    chosen.push(entry.candidate)
    usedSlugs.add(entry.candidate.slug)
    if (entry.candidate.construct === 'konzentration') konzentration++
    minutes += entry.candidate.minutes
  }

  return chosen
}

export function gatherCandidates(db: Db, date: string): PlanCandidate[] {
  const rows = db
    .select({
      gameSlug: sessions.gameSlug,
      startedAt: sessions.startedAt,
      note: sessions.note,
    })
    .from(sessions)
    .orderBy(desc(sessions.startedAt))
    .all()

  const lastPlayed = new Map<string, string>()
  const notesByConstruct = new Map<Construct, number[]>()

  for (const row of rows) {
    if (!lastPlayed.has(row.gameSlug)) lastPlayed.set(row.gameSlug, localDate(row.startedAt))
    const construct = gameBySlug(row.gameSlug)?.construct
    if (!construct || row.note === null) continue
    const bucket = notesByConstruct.get(construct) ?? []
    if (bucket.length < RECENT_FOR_NOTE) {
      bucket.push(row.note)
      notesByConstruct.set(construct, bucket)
    }
  }

  return catalog.map((game) => {
    const played = lastPlayed.get(game.slug)
    return {
      slug: game.slug,
      construct: game.construct,
      minutes: round(game.defaultDurationS / 60, 1),
      note: mean(notesByConstruct.get(game.construct) ?? []),
      daysSincePlayed: played ? daysBetween(played, date) : null,
    }
  })
}

export function buildPlan(db: Db, date: string): DayPlan {
  const existing = db.select().from(planDays).where(eqDate(date)).get()

  if (existing) {
    const slugs = JSON.parse(existing.prescribedJson) as string[]
    return {
      date,
      entries: slugs.map(toEntryFromSlug).filter((entry): entry is PlanEntry => entry !== null),
      minutes: round(
        slugs.reduce((sum, slug) => sum + (gameBySlug(slug)?.defaultDurationS ?? 0) / 60, 0),
        1,
      ),
      completed: JSON.parse(existing.completedJson) as string[],
    }
  }

  const chosen = selectPlan(gatherCandidates(db, date), createRng(date))
  const entries = chosen.map(toEntry)

  db.insert(planDays)
    .values({
      date,
      prescribedJson: JSON.stringify(entries.map((entry) => entry.slug)),
      completedJson: '[]',
    })
    .onConflictDoNothing()
    .run()

  return {
    date,
    entries,
    minutes: round(entries.reduce((sum, entry) => sum + entry.minutes, 0), 1),
    completed: [],
  }
}

export function markPlanCompleted(db: Db, date: string, slug: string): string[] {
  const existing = db.select().from(planDays).where(eqDate(date)).get()
  if (!existing) return []
  const completed = new Set(JSON.parse(existing.completedJson) as string[])
  completed.add(slug)
  const next = [...completed]
  db.update(planDays).set({ completedJson: JSON.stringify(next) }).where(eqDate(date)).run()
  return next
}

function toEntry(candidate: PlanCandidate): PlanEntry {
  const game = gameBySlug(candidate.slug)!
  return {
    slug: candidate.slug,
    name: game.name,
    construct: candidate.construct,
    constructLabel: CONSTRUCT_LABELS[candidate.construct],
    minutes: candidate.minutes,
    reason: reasonFor(candidate),
  }
}

function toEntryFromSlug(slug: string): PlanEntry | null {
  const game = gameBySlug(slug)
  if (!game) return null
  return {
    slug,
    name: game.name,
    construct: game.construct,
    constructLabel: CONSTRUCT_LABELS[game.construct],
    minutes: round(game.defaultDurationS / 60, 1),
    reason: 'aus dem Plan von heute',
  }
}

function eqDate(date: string) {
  return eq(planDays.date, date)
}
