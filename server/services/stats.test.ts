import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb } from '../db/client'
import { saveSession } from './persist'
import { buildStats, buildWeaknesses, HISTORY_DAYS, MIN_TRIALS_FOR_WEAKNESS, RECENT_SESSIONS } from './stats'
import type { SessionPayload } from '../../shared/types'

const NOW = Date.UTC(2026, 5, 15, 18, 0)

function session(id: string, startedAt: number, rawScore: number): SessionPayload {
  return {
    id,
    gameSlug: 'kopfrechnen',
    startedAt,
    finishedAt: startedAt + 120000,
    durationMs: 120000,
    difficulty: 5,
    rawScore,
    accuracy: 0.75,
    seed: 1,
    mode: 'sprint',
    deviceId: 'device-a',
    metrics: {},
    trials: [],
  }
}

let db: ReturnType<typeof createTestDb>['db']

beforeEach(() => {
  db = createTestDb().db
})

describe('buildStats on an empty database', () => {
  it('returns a complete but empty shape without throwing', () => {
    const stats = buildStats(db, NOW)
    expect(stats.totals.sessions).toBe(0)
    expect(stats.streak.current).toBe(0)
    expect(stats.history.dates).toHaveLength(HISTORY_DAYS)
    expect(stats.constructs.every((c) => c.note === null)).toBe(true)
    expect(stats.weekly).toEqual([])
  })

  it('names the exam constructs that have no game yet', () => {
    const stats = buildStats(db, NOW)
    expect(stats.coverage.missing).toContain('text')
    expect(stats.coverage.missing).toContain('sprache')
    expect(stats.coverage.covered).toContain('rechnen')
  })
})

describe('buildStats with history', () => {
  beforeEach(() => {
    for (let i = 0; i < 12; i++) {
      saveSession(db, session(`s-${i}`, Date.UTC(2026, 5, 4 + i, 18, 0), 8 + i))
    }
  })

  it('counts totals and days', () => {
    const stats = buildStats(db, NOW)
    expect(stats.totals.sessions).toBe(12)
    expect(stats.totals.days).toBe(12)
    expect(stats.totals.minutes).toBe(24)
  })

  it('uses only the most recent sessions for the current note', () => {
    const stats = buildStats(db, NOW)
    const rechnen = stats.constructs.find((c) => c.construct === 'rechnen')!
    expect(rechnen.sessions).toBe(12)
    expect(rechnen.note).not.toBeNull()
    expect(rechnen.previousNote).not.toBeNull()
    expect(rechnen.note!).toBeGreaterThan(rechnen.previousNote!)
  })

  it('fills the history with one slot per day and nulls where nothing was trained', () => {
    const stats = buildStats(db, NOW)
    const series = stats.history.series.find((s) => s.construct === 'rechnen')!
    expect(series.values).toHaveLength(HISTORY_DAYS)
    expect(series.values.filter((v) => v !== null)).toHaveLength(12)
    expect(stats.history.dates.at(-1)).toBe('2026-06-15')
  })

  it('averages several sessions on the same day into one point', () => {
    saveSession(db, session('extra', Date.UTC(2026, 5, 4, 20, 0), 30))
    const stats = buildStats(db, NOW)
    const series = stats.history.series.find((s) => s.construct === 'rechnen')!
    const index = stats.history.dates.indexOf('2026-06-04')
    expect(series.values[index]).not.toBeNull()
    expect(stats.totals.sessions).toBe(13)
  })

  it('groups minutes into ISO weeks', () => {
    const stats = buildStats(db, NOW)
    expect(stats.weekly.length).toBeGreaterThan(0)
    const total = stats.weekly.reduce((sum, w) => sum + w.sessions, 0)
    expect(total).toBe(12)
  })

  it('reports an unbroken streak that reaches today', () => {
    const stats = buildStats(db, NOW)
    expect(stats.streak.current).toBe(12)
    expect(stats.streak.longest).toBe(12)
  })

  it('drops the current streak once two days are missed but keeps the record', () => {
    const stats = buildStats(db, Date.UTC(2026, 5, 18, 18, 0))
    expect(stats.streak.current).toBe(0)
    expect(stats.streak.longest).toBe(12)
  })

  it('summarises each game', () => {
    const stats = buildStats(db, NOW)
    const game = stats.games.find((g) => g.slug === 'kopfrechnen')!
    expect(game.sessions).toBe(12)
    expect(game.bestNote).not.toBeNull()
    expect(game.lastPlayedAt).toBe(Date.UTC(2026, 5, 15, 18, 0))
  })

  it('keeps the recent window at the configured size', () => {
    expect(RECENT_SESSIONS).toBe(5)
  })
})

describe('weakness analysis on item type level', () => {
  it('ignores item types below the sample threshold', () => {
    const rows = Array.from({ length: MIN_TRIALS_FOR_WEAKNESS - 1 }, () => ({
      itemType: 'selten',
      gameSlug: 'kopfrechnen',
      correct: 0,
      rtMs: 5000,
    }))
    expect(buildWeaknesses(rows)).toEqual([])
  })

  it('ranks the weakest item type first', () => {
    const make = (itemType: string, accuracy: number, rtMs: number) =>
      Array.from({ length: 20 }, (_, i) => ({
        itemType,
        gameSlug: 'kopfrechnen',
        correct: i < accuracy * 20 ? 1 : 0,
        rtMs,
      }))

    const rows = [...make('stark', 0.95, 2000), ...make('schwach', 0.4, 6000), ...make('mittel', 0.7, 4000)]
    const ranked = buildWeaknesses(rows)

    expect(ranked.map((r) => r.itemType)).toEqual(['schwach', 'mittel', 'stark'])
    expect(ranked[0]!.accuracy).toBeCloseTo(0.4, 2)
    expect(ranked[0]!.meanRtMs).toBe(6000)
    expect(ranked[0]!.trials).toBe(20)
  })

  it('lets a slow but accurate item type outrank a fast inaccurate one only when it should', () => {
    const make = (itemType: string, correctCount: number, rtMs: number) =>
      Array.from({ length: 20 }, (_, i) => ({
        itemType,
        gameSlug: 'kopfrechnen',
        correct: i < correctCount ? 1 : 0,
        rtMs,
      }))
    const ranked = buildWeaknesses([...make('langsam', 20, 9000), ...make('ungenau', 8, 1500)])
    expect(ranked[0]!.itemType).toBe('ungenau')
  })

  it('keeps item types of different games apart', () => {
    const rows = [
      ...Array.from({ length: 20 }, () => ({ itemType: 'x', gameSlug: 'kopfrechnen', correct: 1, rtMs: 1000 })),
      ...Array.from({ length: 20 }, () => ({ itemType: 'x', gameSlug: 'zahlenreihen', correct: 0, rtMs: 1000 })),
    ]
    const ranked = buildWeaknesses(rows)
    expect(ranked).toHaveLength(2)
    expect(new Set(ranked.map((r) => r.gameSlug))).toEqual(new Set(['kopfrechnen', 'zahlenreihen']))
  })

  it('resolves the game name and construct from the catalogue', () => {
    const rows = Array.from({ length: 20 }, () => ({
      itemType: 'multiplikation',
      gameSlug: 'kopfrechnen',
      correct: 1,
      rtMs: 1000,
    }))
    expect(buildWeaknesses(rows)[0]).toMatchObject({ gameName: 'Kopfrechnen', construct: 'rechnen' })
  })
})

describe('time of day and reaction spread', () => {
  it('buckets sessions by the Swiss local hour', () => {
    const db2 = createTestDb().db
    saveSession(db2, { ...session('h1', Date.UTC(2026, 5, 15, 15, 30), 12), trials: [] })
    saveSession(db2, { ...session('h2', Date.UTC(2026, 0, 15, 16, 30), 12), trials: [] })
    const stats = buildStats(db2, NOW)
    expect(stats.hours.map((h) => h.hour)).toEqual([17])
    expect(stats.hours[0]!.sessions).toBe(2)
  })

  it('returns no reaction spread until there are enough trials', () => {
    const db2 = createTestDb().db
    saveSession(db2, session('r1', Date.UTC(2026, 5, 15, 12, 0), 12))
    expect(buildStats(db2, NOW).reaction).toBeNull()
  })

  it('computes the quartile spread once trials exist', () => {
    const db2 = createTestDb().db
    const startedAt = Date.UTC(2026, 5, 15, 12, 0)
    saveSession(db2, {
      ...session('r2', startedAt, 12),
      trials: Array.from({ length: 20 }, (_, i) => ({
        idx: i,
        itemType: 'multiplikation',
        difficulty: 5,
        params: { type: 'multiplikation' },
        response: 1,
        correct: i % 4 !== 0,
        rtMs: 1000 + i * 100,
        presentedAt: startedAt + i * 1000,
      })),
    })
    const reaction = buildStats(db2, NOW).reaction!
    expect(reaction.trials).toBe(20)
    expect(reaction.medianMs).toBe(1950)
    expect(reaction.p25Ms).toBeLessThan(reaction.medianMs)
    expect(reaction.p75Ms).toBeGreaterThan(reaction.medianMs)
    expect(reaction.spreadMs).toBe(reaction.p75Ms - reaction.p25Ms)
    expect(reaction.variation).toBeGreaterThan(0)
  })
})
