import { asc, desc, eq, sql } from 'drizzle-orm'
import { addDays, localDate, localHour, today } from '../../shared/dates'
import { isoWeek, mean, round } from '../../shared/series'
import { CONSTRUCT_LABELS, CONSTRUCT_SHORT_LABELS, EXAM_CONSTRUCTS, type Construct, type NoteSource } from '../../shared/types'
import { games as catalog, coveredConstructs, gameBySlug } from '../../app/games/index'
import { dayLog, sessions, trials } from '../db/schema'
import { currentStreak, longestStreak } from './streak'
import type { Db } from './types'

export const HISTORY_DAYS = 90
export const RECENT_SESSIONS = 5

export interface ConstructStat {
  construct: Construct
  label: string
  shortLabel: string
  sessions: number
  note: number | null
  previousNote: number | null
  noteSource: NoteSource | null
}

export interface GameStat {
  slug: string
  name: string
  construct: Construct
  sessions: number
  lastPlayedAt: number | null
  lastNote: number | null
  bestNote: number | null
}

export interface WeaknessRow {
  itemType: string
  gameSlug: string
  gameName: string
  construct: Construct
  trials: number
  accuracy: number
  meanRtMs: number
  need: number
}

export interface HourRow {
  hour: number
  sessions: number
  meanNote: number | null
  meanRtMs: number | null
}

export interface ReactionSpread {
  trials: number
  medianMs: number
  p25Ms: number
  p75Ms: number
  spreadMs: number
  variation: number
}

export interface StatsPayload {
  generatedAt: number
  totals: { sessions: number; minutes: number; days: number; games: number }
  streak: { current: number; longest: number }
  constructs: ConstructStat[]
  history: { dates: string[]; series: { construct: Construct; label: string; values: (number | null)[] }[] }
  weekly: { week: string; minutes: number; sessions: number }[]
  games: GameStat[]
  weaknesses: WeaknessRow[]
  hours: HourRow[]
  reaction: ReactionSpread | null
  coverage: { covered: Construct[]; missing: Construct[] }
}

export const MIN_TRIALS_FOR_WEAKNESS = 12

function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0
  const pos = (sorted.length - 1) * q
  const lower = Math.floor(pos)
  const upper = Math.ceil(pos)
  if (lower === upper) return sorted[lower]!
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (pos - lower)
}

export function buildWeaknesses(
  rows: readonly { itemType: string; gameSlug: string; correct: number; rtMs: number }[],
): WeaknessRow[] {
  const buckets = new Map<string, { gameSlug: string; correct: number; total: number; rt: number }>()

  for (const row of rows) {
    const key = `${row.gameSlug}::${row.itemType}`
    const bucket = buckets.get(key) ?? { gameSlug: row.gameSlug, correct: 0, total: 0, rt: 0 }
    bucket.correct += row.correct
    bucket.total += 1
    bucket.rt += row.rtMs
    buckets.set(key, bucket)
  }

  const usable = [...buckets.entries()].filter(([, b]) => b.total >= MIN_TRIALS_FOR_WEAKNESS)
  if (usable.length === 0) return []

  const slowest = Math.max(...usable.map(([, b]) => b.rt / b.total))

  return usable
    .map(([key, bucket]) => {
      const itemType = key.split('::')[1]!
      const game = gameBySlug(bucket.gameSlug)
      const accuracy = bucket.correct / bucket.total
      const meanRtMs = bucket.rt / bucket.total
      return {
        itemType,
        gameSlug: bucket.gameSlug,
        gameName: game?.name ?? bucket.gameSlug,
        construct: game?.construct ?? 'rechnen',
        trials: bucket.total,
        accuracy: round(accuracy, 3),
        meanRtMs: Math.round(meanRtMs),
        need: round((1 - accuracy) * 0.7 + (slowest > 0 ? meanRtMs / slowest : 0) * 0.3, 4),
      }
    })
    .sort((a, b) => b.need - a.need)
}

function constructOf(slug: string): Construct | null {
  return gameBySlug(slug)?.construct ?? null
}

export function buildStats(db: Db, now = Date.now()): StatsPayload {
  const rows = db
    .select({
      gameSlug: sessions.gameSlug,
      startedAt: sessions.startedAt,
      durationMs: sessions.durationMs,
      note: sessions.note,
      noteSource: sessions.noteSource,
    })
    .from(sessions)
    .orderBy(asc(sessions.startedAt))
    .all()

  const days = db.select().from(dayLog).orderBy(desc(dayLog.date)).all()
  const dayDates = days.map((day) => day.date)

  const byConstruct = new Map<Construct, typeof rows>()
  for (const row of rows) {
    const construct = constructOf(row.gameSlug)
    if (!construct) continue
    const bucket = byConstruct.get(construct) ?? []
    bucket.push(row)
    byConstruct.set(construct, bucket)
  }

  const constructs: ConstructStat[] = coveredConstructs.map((construct) => {
    const bucket = byConstruct.get(construct) ?? []
    const notes = bucket.map((row) => row.note).filter((note): note is number => note !== null)
    const recent = notes.slice(-RECENT_SESSIONS)
    const previous = notes.slice(-RECENT_SESSIONS * 2, -RECENT_SESSIONS)
    const recentMean = mean(recent)
    const previousMean = mean(previous)
    return {
      construct,
      label: CONSTRUCT_LABELS[construct],
      shortLabel: CONSTRUCT_SHORT_LABELS[construct],
      sessions: bucket.length,
      note: recentMean === null ? null : round(recentMean, 2),
      previousNote: previousMean === null ? null : round(previousMean, 2),
      noteSource: (bucket.at(-1)?.noteSource as NoteSource | undefined) ?? null,
    }
  })

  const startDate = addDays(today(now), -(HISTORY_DAYS - 1))
  const dates: string[] = []
  for (let i = 0; i < HISTORY_DAYS; i++) dates.push(addDays(startDate, i))

  const series = coveredConstructs.map((construct) => {
    const perDay = new Map<string, number[]>()
    for (const row of byConstruct.get(construct) ?? []) {
      if (row.note === null) continue
      const date = localDate(row.startedAt)
      const bucket = perDay.get(date) ?? []
      bucket.push(row.note)
      perDay.set(date, bucket)
    }
    return {
      construct,
      label: CONSTRUCT_LABELS[construct],
      values: dates.map((date) => {
        const notes = perDay.get(date)
        const value = notes ? mean(notes) : null
        return value === null ? null : round(value, 2)
      }),
    }
  })

  const weeklyMap = new Map<string, { minutes: number; sessions: number }>()
  for (const day of days) {
    const week = isoWeek(day.date)
    const bucket = weeklyMap.get(week) ?? { minutes: 0, sessions: 0 }
    bucket.minutes += day.minutes
    bucket.sessions += day.sessionsCount
    weeklyMap.set(week, bucket)
  }
  const weekly = [...weeklyMap.entries()]
    .map(([week, value]) => ({ week, minutes: round(value.minutes, 1), sessions: value.sessions }))
    .sort((a, b) => a.week.localeCompare(b.week))
    .slice(-12)

  const gameStats: GameStat[] = catalog.map((game) => {
    const bucket = rows.filter((row) => row.gameSlug === game.slug)
    const notes = bucket.map((row) => row.note).filter((note): note is number => note !== null)
    return {
      slug: game.slug,
      name: game.name,
      construct: game.construct,
      sessions: bucket.length,
      lastPlayedAt: bucket.at(-1)?.startedAt ?? null,
      lastNote: notes.at(-1) ?? null,
      bestNote: notes.length ? Math.max(...notes) : null,
    }
  })

  const trialRows = db
    .select({
      itemType: trials.itemType,
      correct: trials.correct,
      rtMs: trials.rtMs,
      gameSlug: sessions.gameSlug,
      startedAt: sessions.startedAt,
    })
    .from(trials)
    .innerJoin(sessions, eq(trials.sessionId, sessions.id))
    .all()

  const weaknesses = buildWeaknesses(
    trialRows.map((row) => ({
      itemType: row.itemType,
      gameSlug: row.gameSlug,
      correct: row.correct ? 1 : 0,
      rtMs: row.rtMs,
    })),
  )

  const hourBuckets = new Map<number, { notes: number[]; sessions: number; rt: number[] }>()
  for (const row of rows) {
    const hour = localHour(row.startedAt)
    const bucket = hourBuckets.get(hour) ?? { notes: [], sessions: 0, rt: [] }
    bucket.sessions++
    if (row.note !== null) bucket.notes.push(row.note)
    hourBuckets.set(hour, bucket)
  }
  for (const row of trialRows) {
    const hour = localHour(row.startedAt)
    const bucket = hourBuckets.get(hour)
    if (bucket) bucket.rt.push(row.rtMs)
  }

  const hours: HourRow[] = [...hourBuckets.entries()]
    .map(([hour, bucket]) => {
      const noteMean = mean(bucket.notes)
      const rtMean = mean(bucket.rt)
      return {
        hour,
        sessions: bucket.sessions,
        meanNote: noteMean === null ? null : round(noteMean, 2),
        meanRtMs: rtMean === null ? null : Math.round(rtMean),
      }
    })
    .sort((a, b) => a.hour - b.hour)

  const allRt = trialRows.map((row) => row.rtMs).filter((ms) => ms > 0).sort((a, b) => a - b)
  const rtMean = mean(allRt)
  const reaction: ReactionSpread | null =
    allRt.length < 10 || rtMean === null || rtMean === 0
      ? null
      : {
          trials: allRt.length,
          medianMs: Math.round(quantile(allRt, 0.5)),
          p25Ms: Math.round(quantile(allRt, 0.25)),
          p75Ms: Math.round(quantile(allRt, 0.75)),
          spreadMs: Math.round(quantile(allRt, 0.75) - quantile(allRt, 0.25)),
          variation: round(
            Math.sqrt(allRt.reduce((sum, v) => sum + (v - rtMean) ** 2, 0) / (allRt.length - 1)) / rtMean,
            3,
          ),
        }

  return {
    generatedAt: now,
    totals: {
      sessions: rows.length,
      minutes: round(days.reduce((sum, day) => sum + day.minutes, 0), 1),
      days: days.length,
      games: catalog.length,
    },
    streak: { current: currentStreak(dayDates, now), longest: longestStreak(dayDates) },
    constructs,
    history: { dates, series },
    weekly,
    games: gameStats,
    weaknesses,
    hours,
    reaction,
    coverage: {
      covered: EXAM_CONSTRUCTS.filter((construct) => coveredConstructs.includes(construct)),
      missing: EXAM_CONSTRUCTS.filter((construct) => !coveredConstructs.includes(construct)),
    },
  }
}
