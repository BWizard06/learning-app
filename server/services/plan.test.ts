import { beforeEach, describe, expect, it } from 'vitest'
import { createRng } from '../../shared/rng'
import { createTestDb } from '../db/client'
import { saveSession } from './persist'
import {
  buildPlan,
  gatherCandidates,
  markPlanCompleted,
  MAX_GAMES,
  MAX_KONZENTRATION,
  MIN_GAMES,
  ROTATION_DAYS,
  selectPlan,
  type PlanCandidate,
} from './plan'
import type { Construct, SessionPayload } from '../../shared/types'

function candidate(
  slug: string,
  construct: Construct,
  note: number | null,
  daysSincePlayed: number | null,
  minutes = 2,
): PlanCandidate {
  return { slug, construct, minutes, note, daysSincePlayed }
}

const POOL: PlanCandidate[] = [
  candidate('kopfrechnen', 'rechnen', 4.5, 1),
  candidate('ueberschlag', 'rechnen', 4.5, 3),
  candidate('zahlenreihen', 'logik', 3.2, 2),
  candidate('matrizen', 'logik', 3.2, 4, 3),
  candidate('wortfluss', 'wortfluss', 5.1, 1, 1),
  candidate('d2', 'konzentration', 2.8, 2, 3),
  candidate('symbolzahl', 'konzentration', 2.8, 3, 1.5),
  candidate('stroop', 'konzentration', 2.8, 5, 1.5),
  candidate('nback', 'gedaechtnis', null, null, 2),
]

describe('selectPlan', () => {
  it('picks between four and six games', () => {
    for (let seed = 0; seed < 200; seed++) {
      const plan = selectPlan(POOL, createRng(seed))
      expect(plan.length).toBeGreaterThanOrEqual(MIN_GAMES)
      expect(plan.length).toBeLessThanOrEqual(MAX_GAMES)
    }
  })

  it('never puts the same game in twice', () => {
    for (let seed = 0; seed < 200; seed++) {
      const plan = selectPlan(POOL, createRng(seed))
      expect(new Set(plan.map((entry) => entry.slug)).size).toBe(plan.length)
    }
  })

  it('never schedules more than two concentration games, because they fatigue fast', () => {
    for (let seed = 0; seed < 300; seed++) {
      const plan = selectPlan(POOL, createRng(seed))
      const konz = plan.filter((entry) => entry.construct === 'konzentration').length
      expect(konz, `seed ${seed}`).toBeLessThanOrEqual(MAX_KONZENTRATION)
    }
  })

  it('always includes a game that has been idle for the rotation window', () => {
    const stale = [...POOL, candidate('vergessen', 'logik', 5, ROTATION_DAYS + 3)]
    for (let seed = 0; seed < 100; seed++) {
      const plan = selectPlan(stale, createRng(seed))
      expect(plan.map((e) => e.slug), `seed ${seed}`).toContain('vergessen')
    }
  })

  it('prefers the weaker construct when everything else is equal', () => {
    const pool = [
      candidate('stark-a', 'rechnen', 5.5, 2),
      candidate('stark-b', 'rechnen', 5.5, 2),
      candidate('stark-c', 'wortfluss', 5.5, 2),
      candidate('schwach', 'logik', 2.0, 2),
      candidate('stark-d', 'gedaechtnis', 5.5, 2),
      candidate('stark-e', 'gedaechtnis', 5.5, 2),
    ]
    let picked = 0
    for (let seed = 0; seed < 100; seed++) {
      if (selectPlan(pool, createRng(seed)).some((e) => e.slug === 'schwach')) picked++
    }
    expect(picked).toBeGreaterThan(90)
  })

  it('prefers a game not played for a while over one played today', () => {
    const filler = Array.from({ length: 10 }, (_, i) =>
      candidate(`filler-${i}`, i % 2 === 0 ? 'logik' : 'gedaechtnis', 4, 1),
    )
    const pool = [candidate('frisch', 'rechnen', 4, 0), candidate('alt', 'rechnen', 4, 8), ...filler]

    let alt = 0
    let frisch = 0
    for (let seed = 0; seed < 300; seed++) {
      const slugs = selectPlan(pool, createRng(seed)).map((e) => e.slug)
      if (slugs.includes('alt')) alt++
      if (slugs.includes('frisch')) frisch++
    }
    expect(alt).toBeGreaterThan(frisch)
    expect(alt).toBeGreaterThan(250)
  })

  it('does not simply take the first six of the list', () => {
    const pool = Array.from({ length: 14 }, (_, i) =>
      candidate(`g-${i}`, i % 3 === 0 ? 'logik' : i % 3 === 1 ? 'rechnen' : 'gedaechtnis', 4, 2),
    )
    const picks = new Set<string>()
    for (let seed = 0; seed < 60; seed++) {
      for (const entry of selectPlan(pool, createRng(seed))) picks.add(entry.slug)
    }
    expect(picks.size).toBeGreaterThan(MAX_GAMES)
  })

  it('is deterministic for the same seed', () => {
    const a = selectPlan(POOL, createRng('2026-06-15')).map((e) => e.slug)
    const b = selectPlan(POOL, createRng('2026-06-15')).map((e) => e.slug)
    expect(a).toEqual(b)
  })

  it('varies across days', () => {
    const days = ['2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19']
    const plans = days.map((d) => selectPlan(POOL, createRng(d)).map((e) => e.slug).join(','))
    expect(new Set(plans).size).toBeGreaterThan(1)
  })

  it('covers every game within the rotation window over a simulated month', () => {
    const seen = new Set<string>()
    const lastPlayed = new Map(POOL.map((c) => [c.slug, 0]))
    for (let day = 1; day <= 30; day++) {
      const pool = POOL.map((c) => ({ ...c, daysSincePlayed: day - lastPlayed.get(c.slug)! }))
      const plan = selectPlan(pool, createRng(`day-${day}`))
      for (const entry of plan) {
        seen.add(entry.slug)
        lastPlayed.set(entry.slug, day)
      }
      for (const [slug, last] of lastPlayed) {
        expect(day - last, `${slug} idle on day ${day}`).toBeLessThanOrEqual(ROTATION_DAYS + 2)
      }
    }
    expect(seen.size).toBe(POOL.length)
  })
})

describe('buildPlan against the database', () => {
  let db: ReturnType<typeof createTestDb>['db']

  beforeEach(() => {
    db = createTestDb().db
  })

  function session(id: string, slug: string, startedAt: number): SessionPayload {
    return {
      id,
      gameSlug: slug,
      startedAt,
      finishedAt: startedAt + 120000,
      durationMs: 120000,
      difficulty: 4,
      rawScore: 14,
      accuracy: 0.75,
      seed: 1,
      mode: 'sprint',
      deviceId: 'device-a',
      metrics: {},
      trials: [],
    }
  }

  it('produces a plan on an empty database', () => {
    const plan = buildPlan(db, '2026-06-15')
    expect(plan.entries.length).toBeGreaterThanOrEqual(MIN_GAMES)
    expect(plan.minutes).toBeGreaterThan(0)
    expect(plan.completed).toEqual([])
    expect(plan.entries.every((e) => e.reason.length > 0)).toBe(true)
  })

  it('returns the identical plan when asked again on the same day', () => {
    const first = buildPlan(db, '2026-06-15')
    const second = buildPlan(db, '2026-06-15')
    expect(second.entries.map((e) => e.slug)).toEqual(first.entries.map((e) => e.slug))
  })

  it('marks a game as completed without changing the prescription', () => {
    const plan = buildPlan(db, '2026-06-15')
    const slug = plan.entries[0]!.slug
    const completed = markPlanCompleted(db, '2026-06-15', slug)
    expect(completed).toEqual([slug])
    const again = buildPlan(db, '2026-06-15')
    expect(again.completed).toEqual([slug])
    expect(again.entries.map((e) => e.slug)).toEqual(plan.entries.map((e) => e.slug))
  })

  it('does not add the same completion twice', () => {
    buildPlan(db, '2026-06-15')
    const slug = buildPlan(db, '2026-06-15').entries[0]!.slug
    markPlanCompleted(db, '2026-06-15', slug)
    expect(markPlanCompleted(db, '2026-06-15', slug)).toEqual([slug])
  })

  it('reads how long ago each game was played, in Swiss calendar days', () => {
    saveSession(db, session('a', 'kopfrechnen', Date.UTC(2026, 5, 10, 20, 0)))
    const candidates = gatherCandidates(db, '2026-06-15')
    const kopf = candidates.find((c) => c.slug === 'kopfrechnen')!
    expect(kopf.daysSincePlayed).toBe(5)
    expect(candidates.find((c) => c.slug === 'd2')!.daysSincePlayed).toBeNull()
  })

  it('carries the construct note into the candidates', () => {
    for (let i = 0; i < 3; i++) {
      saveSession(db, session(`k-${i}`, 'kopfrechnen', Date.UTC(2026, 5, 10 + i, 12, 0)))
    }
    const kopf = gatherCandidates(db, '2026-06-15').find((c) => c.slug === 'kopfrechnen')!
    expect(kopf.note).not.toBeNull()
  })
})
