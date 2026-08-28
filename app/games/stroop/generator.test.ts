import { describe, expect, it } from 'vitest'
import { createRng } from '~~/shared/rng'
import { runGeneratorContract } from '~~/shared/testing/generator-contract'
import { propertyRuns } from '~~/shared/testing/property'
import type { TrialResult } from '~~/shared/types'
import definition from './definition'
import {
  COLORS,
  ITEM_TYPES,
  budgetFor,
  generateStroop,
  paletteFor,
  type StroopPayload,
} from './generator'

const DIFFICULTIES = [1, 2, 3, 4]

const EXPECTED_PALETTE: Record<number, string[]> = {
  1: ['gelb', 'gruen', 'rot'],
  2: ['blau', 'gelb', 'gruen', 'rot'],
  3: ['blau', 'gelb', 'gruen', 'rot'],
  4: ['blau', 'gelb', 'gruen', 'rot'],
}

const EXPECTED_BUDGET: Record<number, number> = { 1: 2400, 2: 2000, 3: 1700, 4: 1450 }

const BOTH_TYPES = ['inkongruent', 'kongruent']

function runs(minimum: number): number {
  return Math.max(minimum, propertyRuns())
}

function sorted(values: Iterable<string>): string[] {
  return [...values].sort()
}

function labelOf(payload: StroopPayload): string {
  return payload.word === payload.color ? 'kongruent' : 'inkongruent'
}

function trialAt(index: number, salt: number) {
  const difficulty = DIFFICULTIES[index % DIFFICULTIES.length]!
  return { difficulty, trial: generateStroop(difficulty, createRng(index * salt + 13)) }
}

function emptyBuckets(): Map<number, Set<string>> {
  return new Map(DIFFICULTIES.map((difficulty) => [difficulty, new Set<string>()]))
}

describe('stroop generator', () => {
  it('satisfies the shared generator contract', () => {
    runGeneratorContract(definition, {
      minItemTypes: ITEM_TYPES.length,
      checkTrial: (trial, difficulty) => {
        const payload = trial.payload as StroopPayload
        expect(COLORS).toContain(payload.word)
        expect(COLORS).toContain(payload.color)
        expect(trial.answer).toBe(payload.color)
        expect(payload.budgetMs).toBe(EXPECTED_BUDGET[difficulty])
        expect(sorted(payload.palette)).toEqual(EXPECTED_PALETTE[difficulty])
      },
    })
  })

  it('reaches both item types at every difficulty, the lowest one included', () => {
    const seen = emptyBuckets()
    for (let i = 0; i < runs(400); i++) {
      const { difficulty, trial } = trialAt(i, 2654435761)
      seen.get(difficulty)!.add(trial.itemType)
    }
    expect(sorted(seen.get(1)!)).toEqual(BOTH_TYPES)
    for (const difficulty of DIFFICULTIES) {
      expect(sorted(seen.get(difficulty)!)).toEqual(BOTH_TYPES)
    }
  })

  it('matches the font colour to the word on congruent items and never on incongruent ones', () => {
    const offenders: unknown[] = []
    for (let i = 0; i < runs(400); i++) {
      const { trial } = trialAt(i, 104729)
      const payload = trial.payload
      if (labelOf(payload) !== trial.itemType) offenders.push({ ...payload, declared: trial.itemType })
      if (trial.itemType === 'kongruent' && payload.word !== payload.color) offenders.push(payload)
      if (trial.itemType === 'inkongruent' && payload.word === payload.color) offenders.push(payload)
      if (trial.answer !== payload.color) offenders.push(payload)
    }
    expect(offenders).toEqual([])
  })

  it('lets the parameters rebuild the item without any rendered text', () => {
    for (let i = 0; i < runs(200); i++) {
      const { trial } = trialAt(i, 15485863)
      const params = trial.params as Record<string, unknown>
      expect(params.type).toBe(trial.itemType)
      expect(params.word).toBe(trial.payload.word)
      expect(params.color).toBe(trial.payload.color)
      expect(params.budgetMs).toBe(trial.payload.budgetMs)
      expect(sorted(params.palette as string[])).toEqual(sorted(trial.payload.palette))
      expect(JSON.parse(JSON.stringify(params))).toEqual(params)
    }
  })

  it('puts three colours in play at the lowest difficulty and four above', () => {
    expect(paletteFor(1)).toHaveLength(3)
    for (const difficulty of DIFFICULTIES) {
      expect(sorted(paletteFor(difficulty))).toEqual(EXPECTED_PALETTE[difficulty])
      expect(paletteFor(difficulty)).toHaveLength(EXPECTED_PALETTE[difficulty]!.length)
    }
    expect(paletteFor(2)).toHaveLength(4)
    expect(paletteFor(3)).toHaveLength(4)
    expect(paletteFor(4)).toHaveLength(4)
  })

  it('draws word and font colour only from the palette of that difficulty and uses all of it', () => {
    const words = emptyBuckets()
    const colors = emptyBuckets()
    for (let i = 0; i < runs(600); i++) {
      const { difficulty, trial } = trialAt(i, 32452843)
      words.get(difficulty)!.add(trial.payload.word)
      colors.get(difficulty)!.add(trial.payload.color)
    }
    for (const difficulty of DIFFICULTIES) {
      expect(sorted(words.get(difficulty)!)).toEqual(EXPECTED_PALETTE[difficulty])
      expect(sorted(colors.get(difficulty)!)).toEqual(EXPECTED_PALETTE[difficulty])
    }
  })

  it('covers every word and colour combination of its palette', () => {
    const pairs = emptyBuckets()
    for (let i = 0; i < runs(1200); i++) {
      const { difficulty, trial } = trialAt(i, 99991)
      pairs.get(difficulty)!.add(`${trial.payload.word}>${trial.payload.color}`)
    }
    expect(pairs.get(1)!.size).toBe(9)
    for (const difficulty of [2, 3, 4]) {
      expect(pairs.get(difficulty)!.size).toBe(16)
    }
  })

  it('shortens the presentation budget as difficulty rises', () => {
    for (const difficulty of DIFFICULTIES) {
      expect(budgetFor(difficulty)).toBe(EXPECTED_BUDGET[difficulty])
    }
    for (let difficulty = 2; difficulty <= 4; difficulty++) {
      expect(budgetFor(difficulty)).toBeLessThan(budgetFor(difficulty - 1))
    }
    expect(budgetFor(4)).toBeLessThan(budgetFor(1))
    expect(budgetFor(1)).toBeGreaterThan(0)
  })

  it('mixes roughly forty percent congruent items at every difficulty', () => {
    const total = new Map(DIFFICULTIES.map((difficulty) => [difficulty, 0]))
    const matching = new Map(DIFFICULTIES.map((difficulty) => [difficulty, 0]))
    for (let i = 0; i < runs(4000); i++) {
      const { difficulty, trial } = trialAt(i, 2246822519)
      total.set(difficulty, total.get(difficulty)! + 1)
      if (trial.payload.word === trial.payload.color) {
        matching.set(difficulty, matching.get(difficulty)! + 1)
      }
    }
    for (const difficulty of DIFFICULTIES) {
      const share = matching.get(difficulty)! / total.get(difficulty)!
      expect(share).toBeGreaterThan(0.34)
      expect(share).toBeLessThan(0.46)
    }
  })

  it('produces the same item twice for the same seed', () => {
    for (const difficulty of DIFFICULTIES) {
      const first = generateStroop(difficulty, createRng(20260828))
      const second = generateStroop(difficulty, createRng(20260828))
      expect(JSON.stringify(first)).toBe(JSON.stringify(second))
    }
  })
})

describe('stroop scoring', () => {
  function hit(itemType: string, rtMs: number, difficulty = 2): TrialResult {
    return {
      idx: 0,
      itemType,
      difficulty,
      params: {},
      response: 'rot',
      correct: true,
      rtMs,
      presentedAt: 0,
    }
  }

  function miss(itemType: string, rtMs: number, difficulty = 2): TrialResult {
    return { ...hit(itemType, rtMs, difficulty), correct: false }
  }

  const HAND_WRITTEN: TrialResult[] = [
    hit('kongruent', 620),
    hit('kongruent', 700),
    hit('kongruent', 780),
    hit('kongruent', 900),
    hit('inkongruent', 880),
    hit('inkongruent', 1000),
    hit('inkongruent', 1120),
  ]

  it('reports the interference as the difference of the two medians', () => {
    const score = definition.score(HAND_WRITTEN, 60)
    expect(score.metrics.kongruentMs).toBe(740)
    expect(score.metrics.inkongruentMs).toBe(1000)
    expect(score.metrics.interferenzMs).toBe(260)
    expect(score.metrics.interferenzMs).toBe(score.metrics.inkongruentMs! - score.metrics.kongruentMs!)
    expect(score.metrics.kongruentTreffer).toBe(4)
    expect(score.metrics.inkongruentTreffer).toBe(3)
    expect(score.metrics.attempted).toBe(7)
    expect(score.metrics.correct).toBe(7)
  })

  it('gives the same medians whatever order the trials arrive in', () => {
    const forward = definition.score(HAND_WRITTEN, 60)
    const backward = definition.score(HAND_WRITTEN.slice().reverse(), 60)
    expect(backward.metrics).toEqual(forward.metrics)
  })

  it('keeps wrong answers out of the reaction time medians', () => {
    const score = definition.score(
      [...HAND_WRITTEN, miss('kongruent', 9000), miss('inkongruent', 120)],
      60,
    )
    expect(score.metrics.kongruentMs).toBe(740)
    expect(score.metrics.inkongruentMs).toBe(1000)
    expect(score.metrics.interferenzMs).toBe(260)
    expect(score.metrics.kongruentTreffer).toBe(4)
    expect(score.metrics.inkongruentTreffer).toBe(3)
    expect(score.metrics.attempted).toBe(9)
    expect(score.metrics.correct).toBe(7)
    expect(score.accuracy).toBeCloseTo(7 / 9, 10)
  })

  it('turns a faster incongruent block into a negative interference', () => {
    const score = definition.score(
      [hit('kongruent', 900), hit('kongruent', 900), hit('inkongruent', 700)],
      60,
    )
    expect(score.metrics.kongruentMs).toBe(900)
    expect(score.metrics.inkongruentMs).toBe(700)
    expect(score.metrics.interferenzMs).toBe(-200)
  })

  it('reports no interference while one of the two types has no hit', () => {
    const onlyCongruent = definition.score([hit('kongruent', 700)], 60)
    expect(onlyCongruent.metrics.kongruentMs).toBe(700)
    expect(onlyCongruent.metrics.inkongruentMs).toBe(0)
    expect(onlyCongruent.metrics.interferenzMs).toBe(0)

    const onlyIncongruent = definition.score([hit('inkongruent', 1100)], 60)
    expect(onlyIncongruent.metrics.kongruentMs).toBe(0)
    expect(onlyIncongruent.metrics.inkongruentMs).toBe(1100)
    expect(onlyIncongruent.metrics.interferenzMs).toBe(0)
  })

  it('counts correct answers per minute and rewards the harder level', () => {
    const easy = definition.score([hit('inkongruent', 900, 1), hit('inkongruent', 900, 1)], 30)
    const hard = definition.score([hit('inkongruent', 900, 4), hit('inkongruent', 900, 4)], 30)
    expect(easy.raw).toBe(4)
    expect(hard.raw).toBeCloseTo(5.6, 10)
    expect(easy.accuracy).toBe(1)
    expect(hard.accuracy).toBe(1)
  })

  it('reports zero for an empty session without throwing', () => {
    const score = definition.score([], 60)
    expect(score.raw).toBe(0)
    expect(score.accuracy).toBe(0)
    expect(score.metrics.attempted).toBe(0)
    expect(score.metrics.kongruentMs).toBe(0)
    expect(score.metrics.inkongruentMs).toBe(0)
    expect(score.metrics.interferenzMs).toBe(0)
  })

  it('exposes the metric keys the paradigm needs', () => {
    const keys = Object.keys(definition.score(HAND_WRITTEN, 60).metrics).sort()
    expect(keys).toContain('kongruentMs')
    expect(keys).toContain('inkongruentMs')
    expect(keys).toContain('interferenzMs')
    expect(keys).toContain('kongruentTreffer')
    expect(keys).toContain('inkongruentTreffer')
  })
})
