import { asc, desc } from 'drizzle-orm'
import { addDays, localDate, today } from '../../shared/dates'
import { isoWeek, mean, round } from '../../shared/series'
import { CONSTRUCT_LABELS, CONSTRUCT_SHORT_LABELS, EXAM_CONSTRUCTS, type Construct, type NoteSource } from '../../shared/types'
import { games as catalog, coveredConstructs, gameBySlug } from '../../app/games/index'
import { dayLog, sessions } from '../db/schema'
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

export interface StatsPayload {
  generatedAt: number
  totals: { sessions: number; minutes: number; days: number; games: number }
  streak: { current: number; longest: number }
  constructs: ConstructStat[]
  history: { dates: string[]; series: { construct: Construct; label: string; values: (number | null)[] }[] }
  weekly: { week: string; minutes: number; sessions: number }[]
  games: GameStat[]
  coverage: { covered: Construct[]; missing: Construct[] }
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
    coverage: {
      covered: EXAM_CONSTRUCTS.filter((construct) => coveredConstructs.includes(construct)),
      missing: EXAM_CONSTRUCTS.filter((construct) => !coveredConstructs.includes(construct)),
    },
  }
}
