import { describe, expect, it } from 'vitest'
import { createRng } from '~~/shared/rng'
import { runGeneratorContract } from '~~/shared/testing/generator-contract'
import { propertyRuns } from '~~/shared/testing/property'
import type { TrialResult } from '~~/shared/types'
import definition from './definition'
import {
  HIGHEST_DIGIT,
  ITEM_TYPES,
  LOWEST_DIGIT,
  MAX_LENGTH,
  MIN_LENGTH,
  directionForSeed,
  generateSpan,
  spanLength,
  type ItemType,
  type SpanPayload,
} from './generator'

const DIFFICULTIES = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

function payloadOf(trial: { payload: unknown }): SpanPayload {
  return trial.payload as SpanPayload
}

describe('zahlenspanne generator', () => {
  it('satisfies the shared generator contract', () => {
    runGeneratorContract(definition, {
      difficulties: DIFFICULTIES,
      expectIntegerAnswer: true,
      minItemTypes: ITEM_TYPES.length,
      checkTrial: (trial) => {
        const payload = payloadOf(trial)
        expect(Array.isArray(payload.digits)).toBe(true)
        expect(payload.prompt.length).toBeGreaterThan(0)
        expect(payload.hint.length).toBeGreaterThan(0)
        expect(payload.digitMs).toBeGreaterThan(0)
        expect(payload.gapMs).toBeGreaterThan(0)
      },
    })
  })

  it('shows exactly as many digits as the declared span length', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const difficulty = DIFFICULTIES[i % DIFFICULTIES.length]!
      const trial = generateSpan(difficulty, createRng(i * 7919 + 1))
      const written = String(trial.answer)

      expect(trial.difficulty).toBe(difficulty)
      expect(written.length).toBe(difficulty)
      expect(payloadOf(trial).digits.length).toBe(difficulty)
      expect(trial.params.length).toBe(difficulty)
      expect((trial.params.digits as number[]).length).toBe(difficulty)
    }
  })

  it('keeps every digit between one and nine so no leading zero can vanish', () => {
    const runs = propertyRuns()
    const seen = new Set<number>()
    for (let i = 0; i < runs; i++) {
      const trial = generateSpan(DIFFICULTIES[i % DIFFICULTIES.length]!, createRng(i * 104729 + 5))
      for (const digit of payloadOf(trial).digits) {
        expect(Number.isInteger(digit)).toBe(true)
        expect(digit).toBeGreaterThanOrEqual(LOWEST_DIGIT)
        expect(digit).toBeLessThanOrEqual(HIGHEST_DIGIT)
        seen.add(digit)
      }
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('never repeats a digit immediately and still reaches every other digit', () => {
    const runs = propertyRuns()
    const offsets = new Set<number>()
    for (let i = 0; i < runs; i++) {
      const trial = generateSpan(DIFFICULTIES[i % DIFFICULTIES.length]!, createRng(i * 31337 + 11))
      const digits = payloadOf(trial).digits
      for (let k = 1; k < digits.length; k++) {
        const previous = digits[k - 1]!
        const value = digits[k]!
        expect(value, `digit ${k} repeats ${previous}`).not.toBe(previous)
        offsets.add((value - previous + 9) % 9)
      }
    }
    expect([...offsets].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('expects the shown order forwards and the mirrored order backwards', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const trial = generateSpan(DIFFICULTIES[i % DIFFICULTIES.length]!, createRng(i * 2654435761 + 3))
      const digits = payloadOf(trial).digits
      const written = String(trial.answer)
      const last = digits.length - 1

      for (let k = 0; k <= last; k++) {
        const wanted = trial.itemType === 'rueckwaerts' ? digits[last - k]! : digits[k]!
        expect(Number(written[k]), `position ${k} of ${trial.itemType}`).toBe(wanted)
      }

      const forwards = digits.reduce((total, digit) => total * 10 + digit, 0)
      const backwards = digits.reduceRight((total, digit) => total * 10 + digit, 0)
      expect(trial.answer).toBe(trial.itemType === 'rueckwaerts' ? backwards : forwards)

      expect(Number(written[0])).toBe(trial.itemType === 'rueckwaerts' ? digits[last] : digits[0])
      expect(Number(written[last])).toBe(trial.itemType === 'rueckwaerts' ? digits[0] : digits[last])
    }
  })

  it('offers both directions at every span length, the shortest included', () => {
    const byLength = new Map<number, Set<ItemType>>()
    for (const difficulty of DIFFICULTIES) {
      const directions = new Set<ItemType>()
      for (let seed = 1; seed <= 200; seed++) {
        directions.add(generateSpan(difficulty, createRng(seed)).itemType as ItemType)
      }
      byLength.set(difficulty, directions)
    }

    expect([...byLength.get(MIN_LENGTH)!].sort()).toEqual(['rueckwaerts', 'vorwaerts'])
    for (const difficulty of DIFFICULTIES) {
      expect([...byLength.get(difficulty)!].sort(), `span ${difficulty}`).toEqual([
        'rueckwaerts',
        'vorwaerts',
      ])
    }
  })

  it('picks the direction from the seed alone, never from the span length', () => {
    for (let seed = 1; seed <= 120; seed++) {
      const directions = DIFFICULTIES.map((d) => generateSpan(d, createRng(seed)).itemType)
      expect(new Set(directions).size, `seed ${seed} changed direction mid session`).toBe(1)
      expect(directions[0]).toBe(directionForSeed(createRng(seed).seed))
    }
  })

  it('maps difficulty onto a span length inside the declared bounds', () => {
    expect(spanLength(3)).toBe(3)
    expect(spanLength(7)).toBe(7)
    expect(spanLength(12)).toBe(12)
    expect(spanLength(0)).toBe(MIN_LENGTH)
    expect(spanLength(-4)).toBe(MIN_LENGTH)
    expect(spanLength(40)).toBe(MAX_LENGTH)
    expect(spanLength(Number.NaN)).toBe(MIN_LENGTH)
    expect(spanLength(6.4)).toBe(6)
    expect(spanLength(6.5)).toBe(7)
  })
})

function result(
  difficulty: number,
  correct: boolean,
  itemType: ItemType = 'vorwaerts',
  rtMs = 4000,
): TrialResult {
  return {
    idx: 0,
    itemType,
    difficulty,
    params: {},
    response: 123,
    correct,
    rtMs,
    presentedAt: 0,
  }
}

describe('zahlenspanne scoring', () => {
  it('reports the highest span that was solved, not the last one attempted', () => {
    const score = definition.score(
      [
        result(3, true),
        result(3, true),
        result(4, false),
        result(4, true),
        result(5, false),
        result(5, false),
      ],
      120,
    )
    expect(score.raw).toBe(4)
    expect(score.metrics.spanne).toBe(4)
    expect(score.metrics.versuche).toBe(6)
    expect(score.metrics.korrekt).toBe(3)
    expect(score.accuracy).toBe(0.5)
  })

  it('keeps the best span even when a shorter one is solved afterwards', () => {
    const score = definition.score([result(9, true), result(4, true), result(5, true)], 120)
    expect(score.raw).toBe(9)
    expect(score.metrics.spanne).toBe(9)
    expect(score.metrics.vorwaertsSpanne).toBe(9)
  })

  it('scores zero when nothing was solved', () => {
    const score = definition.score([result(3, false), result(3, false), result(3, false)], 90)
    expect(score.raw).toBe(0)
    expect(score.metrics.spanne).toBe(0)
    expect(score.metrics.korrekt).toBe(0)
    expect(score.accuracy).toBe(0)
  })

  it('survives an empty session', () => {
    const score = definition.score([], 60)
    expect(score.raw).toBe(0)
    expect(score.accuracy).toBe(0)
    expect(score.metrics.versuche).toBe(0)
    expect(score.metrics.medianRtMs).toBe(0)
    expect(score.metrics).not.toHaveProperty('vorwaertsSpanne')
    expect(score.metrics).not.toHaveProperty('rueckwaertsSpanne')
  })

  it('names the metric after the direction the session used', () => {
    const forwards = definition.score([result(6, true, 'vorwaerts'), result(7, false, 'vorwaerts')], 60)
    expect(forwards.metrics.vorwaertsSpanne).toBe(6)
    expect(forwards.metrics).not.toHaveProperty('rueckwaertsSpanne')

    const backwards = definition.score(
      [result(5, true, 'rueckwaerts'), result(6, true, 'rueckwaerts')],
      60,
    )
    expect(backwards.metrics.rueckwaertsSpanne).toBe(6)
    expect(backwards.metrics).not.toHaveProperty('vorwaertsSpanne')
  })

  it('takes the median over every attempt', () => {
    const score = definition.score(
      [
        result(3, true, 'vorwaerts', 4200),
        result(3, false, 'vorwaerts', 5100),
        result(3, true, 'vorwaerts', 3600),
        result(4, false, 'vorwaerts', 6000),
      ],
      120,
    )
    expect(score.metrics.medianRtMs).toBe(4650)
  })

  it('rates a longer span above a shorter one', () => {
    const short = definition.score([result(4, true)], 120)
    const long = definition.score([result(9, true)], 120)
    expect(long.raw).toBeGreaterThan(short.raw)
    expect(definition.weight(12)).toBeGreaterThan(definition.weight(3))
  })
})
