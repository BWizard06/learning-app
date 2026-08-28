import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb } from '../db/client'
import { saveSession } from './persist'
import { buildStats, HISTORY_DAYS, RECENT_SESSIONS } from './stats'
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
