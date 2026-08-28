import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestDb } from '../db/client'
import { dayLog, sessions, trials } from '../db/schema'
import { saveSession } from './persist'
import { rebuildDayLog } from './daylog'
import type { SessionPayload } from '../../shared/types'

function payload(overrides: Partial<SessionPayload> = {}): SessionPayload {
  const startedAt = overrides.startedAt ?? Date.UTC(2026, 5, 15, 15, 30)
  return {
    id: 'session-1',
    gameSlug: 'kopfrechnen',
    startedAt,
    finishedAt: startedAt + 120000,
    durationMs: 120000,
    difficulty: 5,
    rawScore: 14,
    accuracy: 0.75,
    seed: 4242,
    mode: 'sprint',
    deviceId: 'device-a',
    metrics: { attempted: 12, correct: 9 },
    trials: [
      {
        idx: 0,
        itemType: 'multiplikation',
        difficulty: 5,
        params: { type: 'multiplikation', a: 7, b: 8 },
        response: 56,
        correct: true,
        rtMs: 3100,
        presentedAt: startedAt,
      },
      {
        idx: 1,
        itemType: 'prozentwert',
        difficulty: 5,
        params: { type: 'prozentwert', percent: 20, base: 250 },
        response: 40,
        correct: false,
        rtMs: 5200,
        presentedAt: startedAt + 3100,
      },
    ],
    ...overrides,
  }
}

let db: ReturnType<typeof createTestDb>['db']

beforeEach(() => {
  db = createTestDb().db
})

describe('saveSession', () => {
  it('writes the session and every single trial', () => {
    const result = saveSession(db, payload())
    expect(result.created).toBe(true)

    const stored = db.select().from(sessions).all()
    expect(stored).toHaveLength(1)
    expect(stored[0]!.gameSlug).toBe('kopfrechnen')
    expect(stored[0]!.seed).toBe(4242)

    const storedTrials = db.select().from(trials).where(eq(trials.sessionId, 'session-1')).all()
    expect(storedTrials).toHaveLength(2)
    expect(JSON.parse(storedTrials[0]!.itemJson)).toEqual({ type: 'multiplikation', a: 7, b: 8 })
    expect(storedTrials[1]!.correct).toBe(false)
  })

  it('stores parameters rather than rendered text', () => {
    saveSession(db, payload())
    const stored = db.select().from(trials).all()
    for (const trial of stored) {
      const parsed = JSON.parse(trial.itemJson) as Record<string, unknown>
      expect(parsed).toHaveProperty('type')
      expect(JSON.stringify(parsed)).not.toMatch(/von|Prozent|kosten/)
    }
  })

  it('is idempotent, so a retried send creates nothing new', () => {
    const first = saveSession(db, payload())
    const second = saveSession(db, payload())
    const third = saveSession(db, payload({ rawScore: 999 }))

    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
    expect(third.created).toBe(false)

    expect(db.select().from(sessions).all()).toHaveLength(1)
    expect(db.select().from(trials).all()).toHaveLength(2)
    expect(db.select().from(sessions).all()[0]!.rawScore).toBe(14)
  })

  it('returns the stored note on a duplicate send', () => {
    const first = saveSession(db, payload())
    const second = saveSession(db, payload())
    expect(second.note?.value).toBe(first.note?.value)
  })

  it('grades from the start thresholds while history is thin', () => {
    const result = saveSession(db, payload())
    expect(result.note?.source).toBe('thresholds')
    expect(result.note?.value).toBe(4)
  })

  it('switches to personal norming once twenty sessions exist', () => {
    for (let i = 0; i < 20; i++) {
      saveSession(
        db,
        payload({
          id: `history-${i}`,
          startedAt: Date.UTC(2026, 5, 1, 12, 0) + i * 86400000,
          rawScore: 10 + (i % 5),
        }),
      )
    }
    const result = saveSession(db, payload({ id: 'fresh', rawScore: 12 }))
    expect(result.note?.source).toBe('personal')
    expect(result.note?.sampleSize).toBeGreaterThanOrEqual(20)
  })

  it('rejects an unknown game', () => {
    expect(() => saveSession(db, payload({ gameSlug: 'gibt-es-nicht' }))).toThrow()
  })

  it('rolls the whole write back if the trials fail', () => {
    const broken = payload({ id: 'broken' })
    broken.trials = [{ ...broken.trials[0]!, idx: null as unknown as number }]
    expect(() => saveSession(db, broken)).toThrow()
    expect(db.select().from(sessions).where(eq(sessions.id, 'broken')).all()).toHaveLength(0)
  })
})

describe('day log', () => {
  it('groups sessions by the Swiss calendar day, not the UTC day', () => {
    saveSession(db, payload({ id: 'late', startedAt: Date.UTC(2026, 5, 15, 22, 30) }))
    const rows = db.select().from(dayLog).all()
    expect(rows).toHaveLength(1)
    expect(rows[0]!.date).toBe('2026-06-16')
  })

  it('accumulates count and minutes across a day', () => {
    saveSession(db, payload({ id: 'a', startedAt: Date.UTC(2026, 5, 15, 8, 0) }))
    saveSession(db, payload({ id: 'b', startedAt: Date.UTC(2026, 5, 15, 9, 0) }))
    const row = db.select().from(dayLog).all()[0]!
    expect(row.sessionsCount).toBe(2)
    expect(row.minutes).toBe(4)
    expect(row.meanNote).not.toBeNull()
  })

  it('can be rebuilt from the raw sessions at any time', () => {
    saveSession(db, payload({ id: 'a', startedAt: Date.UTC(2026, 5, 15, 8, 0) }))
    saveSession(db, payload({ id: 'b', startedAt: Date.UTC(2026, 6, 20, 8, 0) }))
    const before = db.select().from(dayLog).all()

    db.delete(dayLog).run()
    expect(db.select().from(dayLog).all()).toHaveLength(0)

    const days = rebuildDayLog(db)
    expect(days).toBe(2)
    expect(db.select().from(dayLog).all()).toEqual(before)
  })
})
