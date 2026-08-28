import { describe, expect, it } from 'vitest'
import { createRng } from '~~/shared/rng'
import { runGeneratorContract } from '~~/shared/testing/generator-contract'
import { propertyRuns } from '~~/shared/testing/property'
import type { JsonObject, TrialResult } from '~~/shared/types'
import definition from './definition'
import {
  ITEM_TYPES,
  generateComparison,
  lookalikeWeightFor,
  unrelatedReplacements,
  type ComparePayload,
  type CompareTrial,
} from './generator'

const DIFFICULTIES = [1, 2, 3, 4, 5, 6]

const EXPECTED_LENGTHS: Record<number, number> = { 1: 6, 2: 8, 3: 10, 4: 13, 5: 15, 6: 18 }

const BASE_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const DIGIT_CHARS = '0123456789'

const DECLARED_LOOKALIKES = ['0O', '1l', '5S', '8B', '6b', '2Z']

function isDeclaredPair(a: string, b: string): boolean {
  return DECLARED_LOOKALIKES.includes(a + b) || DECLARED_LOOKALIKES.includes(b + a)
}

function pairKey(a: string, b: string): string {
  return DECLARED_LOOKALIKES.includes(a + b) ? a + b : b + a
}

function diffPositions(a: string, b: string): number[] {
  const out: number[] = []
  const span = Math.max(a.length, b.length)
  for (let i = 0; i < span; i++) {
    if (a[i] !== b[i]) out.push(i)
  }
  return out
}

function fromBaseAlphabet(value: string): boolean {
  return value.split('').every((char) => BASE_CHARS.includes(char))
}

function trialAt(index: number, salt: number, difficulty?: number): CompareTrial {
  const level = difficulty ?? DIFFICULTIES[index % DIFFICULTIES.length]!
  return generateComparison(level, createRng(index * salt + 1))
}

function partsOf(trial: CompareTrial): {
  top: string
  bottom: string
  params: JsonObject
  position: number
  base: string
} {
  const payload = trial.payload as ComparePayload
  const params = trial.params as JsonObject
  return {
    top: payload.top,
    bottom: payload.bottom,
    params,
    position: Number(params.position),
    base: String(params.base),
  }
}

function rebuild(params: JsonObject): { top: string; bottom: string } {
  const base = String(params.base)
  const type = String(params.type)
  const position = Number(params.position)
  const chars = base.split('')

  if (type === 'zifferntausch') {
    const held = chars[position]!
    chars[position] = chars[position + 1]!
    chars[position + 1] = held
  } else if (type !== 'identisch') {
    chars[position] = String(params.replacement)
  }

  const variant = chars.join('')
  return {
    top: params.line === 'top' ? variant : base,
    bottom: params.line === 'bottom' ? variant : base,
  }
}

describe('zeichenvergleich generator', () => {
  it('satisfies the shared generator contract', () => {
    runGeneratorContract(definition, {
      minItemTypes: 4,
      checkTrial: (trial, difficulty) => {
        const payload = trial.payload as ComparePayload
        expect(ITEM_TYPES).toContain(trial.itemType)
        expect(trial.difficulty).toBe(difficulty)
        expect(payload.top.length).toBe(payload.bottom.length)
        expect(payload.top.length).toBe(EXPECTED_LENGTHS[difficulty])
        expect(payload.length).toBe(payload.top.length)
        expect(trial.answer).toBe(payload.top === payload.bottom)
      },
    })
  })

  it('calls an item identical only when both rows match character for character', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const trial = trialAt(i, 2654435761)
      const { top, bottom } = partsOf(trial)
      const identical = top === bottom
      expect(trial.answer).toBe(identical)
      expect(trial.itemType === 'identisch').toBe(identical)
      expect(trial.params.same).toBe(identical)
      if (identical) {
        expect(diffPositions(top, bottom)).toEqual([])
        expect(trial.params.position).toBeNull()
        expect(trial.params.line).toBeNull()
      } else {
        expect(diffPositions(top, bottom).length).toBeGreaterThan(0)
      }
    }
  })

  it('builds both rows from digits and upper case letters only', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const trial = trialAt(i, 104729)
      const { top, bottom, base, params } = partsOf(trial)
      expect(fromBaseAlphabet(base)).toBe(true)
      expect(base.length).toBe(Number(params.length))
      const untouched = params.line === 'top' ? bottom : top
      expect(untouched).toBe(base)
      if (params.line !== 'bottom') expect(fromBaseAlphabet(bottom)).toBe(true)
      if (params.line !== 'top') expect(fromBaseAlphabet(top)).toBe(true)
    }
  })

  it('takes the row length straight from the difficulty', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const difficulty = DIFFICULTIES[i % DIFFICULTIES.length]!
      const trial = trialAt(i, 32452843)
      const { top, bottom, params } = partsOf(trial)
      expect(top.length).toBe(EXPECTED_LENGTHS[difficulty])
      expect(bottom.length).toBe(top.length)
      expect(Number(params.length)).toBe(top.length)
      expect(top.length).toBeGreaterThanOrEqual(6)
      expect(top.length).toBeLessThanOrEqual(18)
    }
  })

  it('swaps exactly two adjacent and different digits for zifferntausch', () => {
    const runs = propertyRuns()
    let seen = 0
    for (let i = 0; i < runs; i++) {
      const trial = trialAt(i, 7919)
      if (trial.itemType !== 'zifferntausch') continue
      seen++
      const { top, bottom, position } = partsOf(trial)
      expect(diffPositions(top, bottom)).toEqual([position, position + 1])
      expect(top[position]).toBe(bottom[position + 1])
      expect(top[position + 1]).toBe(bottom[position])
      expect(top[position]).not.toBe(top[position + 1])
      expect(DIGIT_CHARS).toContain(top[position]!)
      expect(DIGIT_CHARS).toContain(top[position + 1]!)
      expect(position).toBeGreaterThanOrEqual(0)
      expect(position + 1).toBeLessThan(top.length)
    }
    expect(seen).toBeGreaterThan(0)
  })

  it('replaces one character with a declared look-alike for aehnliche-glyphe', () => {
    const runs = propertyRuns()
    const used = new Set<string>()
    let seen = 0
    for (let i = 0; i < runs; i++) {
      const trial = trialAt(i, 15485863)
      if (trial.itemType !== 'aehnliche-glyphe') continue
      seen++
      const { top, bottom, position, base, params } = partsOf(trial)
      expect(diffPositions(top, bottom)).toEqual([position])
      const before = top[position]!
      const after = bottom[position]!
      expect(isDeclaredPair(before, after)).toBe(true)
      expect(base[position]).toBe(params.line === 'top' ? after : before)
      expect(String(params.replacement)).toBe(params.line === 'top' ? before : after)
      used.add(pairKey(before, after))
    }
    expect(seen).toBeGreaterThan(0)
    expect([...used].sort()).toEqual([...DECLARED_LOOKALIKES].sort())
  })

  it('offers every character except the original and its look-alikes as unrelated replacement', () => {
    for (const original of BASE_CHARS.split('')) {
      const expected = BASE_CHARS.split('').filter(
        (char) => char !== original && !isDeclaredPair(char, original),
      )
      expect(unrelatedReplacements(original).slice().sort(), original).toEqual(expected.slice().sort())
    }
  })

  it('replaces one character with an unrelated one for ein-zeichen', () => {
    const runs = Math.max(propertyRuns(), 60000)
    const swaps = new Map<string, Set<string>>()
    let seen = 0
    for (let i = 0; i < runs; i++) {
      const trial = trialAt(i, 99991)
      if (trial.itemType !== 'ein-zeichen') continue
      seen++
      const { top, bottom, position, base, params } = partsOf(trial)
      expect(diffPositions(top, bottom)).toEqual([position])
      const before = top[position]!
      const after = bottom[position]!
      expect(before).not.toBe(after)
      expect(isDeclaredPair(before, after)).toBe(false)
      expect(BASE_CHARS).toContain(before)
      expect(BASE_CHARS).toContain(after)
      const original = params.line === 'top' ? after : before
      expect(base[position]).toBe(original)
      expect(String(params.replacement)).toBe(params.line === 'top' ? before : after)
      const bucket = swaps.get(original) ?? new Set<string>()
      bucket.add(String(params.replacement))
      swaps.set(original, bucket)
    }

    expect(seen).toBeGreaterThan(0)

    for (const pair of DECLARED_LOOKALIKES) {
      for (const original of [pair[0]!, pair[1]!]) {
        const bucket = swaps.get(original)
        if (!BASE_CHARS.includes(original)) continue
        expect(bucket, `no sample replaced ${original}`).toBeDefined()
        expect(bucket!.size, `too few replacements tried for ${original}`).toBeGreaterThan(28)
        expect([...bucket!], `${original} was replaced by its look-alike`).not.toContain(
          original === pair[0] ? pair[1] : pair[0],
        )
      }
    }
  })

  it('lets params alone rebuild both rows', () => {
    const runs = Math.min(propertyRuns(), 4000)
    for (let i = 0; i < runs; i++) {
      const trial = trialAt(i, 2246822519)
      const { top, bottom, params } = partsOf(trial)
      expect(rebuild(params)).toEqual({ top, bottom })
      expect(String(params.type)).toBe(trial.itemType)
    }
  })

  it('shows all four item types at every difficulty, the lowest included', () => {
    for (const difficulty of DIFFICULTIES) {
      const seen = new Set<string>()
      for (let i = 0; i < 900; i++) {
        seen.add(generateComparison(difficulty, createRng(i * 40503 + 11)).itemType)
      }
      expect([...seen].sort(), `difficulty ${difficulty}`).toEqual([...ITEM_TYPES].sort())
    }
  })

  it('keeps about half of the items identical at every difficulty', () => {
    for (const difficulty of DIFFICULTIES) {
      const rounds = 4000
      let identical = 0
      for (let i = 0; i < rounds; i++) {
        if (generateComparison(difficulty, createRng(i * 22695477 + 3)).answer) identical++
      }
      const share = identical / rounds
      expect(share, `difficulty ${difficulty}`).toBeGreaterThan(0.44)
      expect(share, `difficulty ${difficulty}`).toBeLessThan(0.56)
    }
  })

  it('weights the look-alike kind heavier with rising difficulty, without losing the other kinds', () => {
    const shares: number[] = []

    for (const difficulty of DIFFICULTIES) {
      const counts = new Map<string, number>()
      const rounds = 4000
      for (let i = 0; i < rounds; i++) {
        const trial = generateComparison(difficulty, createRng(i * 69069 + 17))
        if (trial.answer) continue
        counts.set(trial.itemType, (counts.get(trial.itemType) ?? 0) + 1)
      }
      const differing = [...counts.values()].reduce((sum, value) => sum + value, 0)
      expect(counts.get('zifferntausch') ?? 0, `difficulty ${difficulty}`).toBeGreaterThan(0)
      expect(counts.get('ein-zeichen') ?? 0, `difficulty ${difficulty}`).toBeGreaterThan(0)
      shares.push((counts.get('aehnliche-glyphe') ?? 0) / differing)
    }

    for (let i = 1; i < shares.length; i++) {
      expect(shares[i]!, `share at difficulty ${i + 1}`).toBeGreaterThan(shares[i - 1]!)
      expect(lookalikeWeightFor(i + 1)).toBeGreaterThan(lookalikeWeightFor(i))
    }
    expect(shares[0]!).toBeGreaterThan(0.28)
    expect(shares[0]!).toBeLessThan(0.4)
    expect(shares[shares.length - 1]!).toBeGreaterThan(0.7)
  })

  it('spreads the difference over the whole row and over both lines', () => {
    const difficulty = 6
    const length = EXPECTED_LENGTHS[difficulty]!
    const hits = new Array<number>(length).fill(0)
    let onTop = 0
    let differing = 0
    let positionSum = 0

    for (let i = 0; i < 6000; i++) {
      const trial = generateComparison(difficulty, createRng(i * 1103515245 + 12345))
      if (trial.answer) continue
      const { position, params } = partsOf(trial)
      differing++
      hits[position]!++
      positionSum += position / (length - 1)
      if (params.line === 'top') onTop++
    }

    expect(Math.min(...hits)).toBeGreaterThan(0)
    expect(positionSum / differing).toBeGreaterThan(0.42)
    expect(positionSum / differing).toBeLessThan(0.58)
    expect(onTop / differing).toBeGreaterThan(0.44)
    expect(onTop / differing).toBeLessThan(0.56)
  })

  it('produces the same pair twice for the same seed', () => {
    for (const difficulty of DIFFICULTIES) {
      const first = generateComparison(difficulty, createRng(987654))
      const second = generateComparison(difficulty, createRng(987654))
      expect(JSON.stringify(first)).toBe(JSON.stringify(second))
    }
  })
})

describe('zeichenvergleich scoring', () => {
  function resultFor(same: boolean, response: boolean, difficulty = 1, rtMs = 1000): TrialResult {
    return {
      idx: 0,
      itemType: same ? 'identisch' : 'ein-zeichen',
      difficulty,
      params: {
        type: same ? 'identisch' : 'ein-zeichen',
        length: 6,
        base: 'A7KQ2M',
        position: same ? null : 3,
        replacement: same ? null : 'X',
        line: same ? null : 'top',
        same,
      },
      response,
      correct: response === same,
      rtMs,
      presentedAt: 0,
    }
  }

  it('keeps the two error kinds apart', () => {
    const score = definition.score(
      [
        resultFor(true, true),
        resultFor(true, false),
        resultFor(false, true),
        resultFor(false, false),
        resultFor(false, true),
      ],
      60,
    )

    expect(score.metrics.attempted).toBe(5)
    expect(score.metrics.correct).toBe(2)
    expect(score.metrics.falschGleich).toBe(2)
    expect(score.metrics.falschVerschieden).toBe(1)
    expect(score.accuracy).toBeCloseTo(2 / 5, 10)
  })

  it('reports no errors for a flawless run', () => {
    const score = definition.score([resultFor(true, true), resultFor(false, false)], 60)
    expect(score.metrics.falschGleich).toBe(0)
    expect(score.metrics.falschVerschieden).toBe(0)
    expect(score.accuracy).toBe(1)
  })

  it('counts weighted correct answers per minute', () => {
    expect(definition.weight(1)).toBeCloseTo(1, 10)
    expect(definition.weight(6)).toBeCloseTo(2, 10)
    expect(definition.weight(3.5)).toBeCloseTo(1.5, 10)

    const trials = [resultFor(true, true, 1), resultFor(false, false, 6), resultFor(true, false, 6)]
    expect(definition.score(trials, 60).raw).toBeCloseTo(3, 10)
    expect(definition.score(trials, 30).raw).toBeCloseTo(6, 10)
    expect(definition.score(trials, 120).raw).toBeCloseTo(1.5, 10)
  })

  it('takes the median reaction time from the correct answers alone', () => {
    const score = definition.score(
      [
        resultFor(true, true, 1, 1000),
        resultFor(false, false, 1, 5000),
        resultFor(true, true, 1, 3000),
        resultFor(true, false, 1, 99000),
      ],
      60,
    )
    expect(score.metrics.medianRtMs).toBe(3000)
  })

  it('reports zero for an empty session without throwing', () => {
    const score = definition.score([], 60)
    expect(score.raw).toBe(0)
    expect(score.accuracy).toBe(0)
    expect(score.metrics.attempted).toBe(0)
    expect(score.metrics.correct).toBe(0)
    expect(score.metrics.medianRtMs).toBe(0)
    expect(score.metrics.falschGleich).toBe(0)
    expect(score.metrics.falschVerschieden).toBe(0)
  })

  it('accepts a boolean answer only when it matches the item', () => {
    const identical = generateComparison(3, createRng(4242))
    const other = generateComparison(3, createRng(4243))
    for (const trial of [identical, other]) {
      expect(definition.isCorrect!(trial, trial.answer)).toBe(true)
      expect(definition.isCorrect!(trial, !trial.answer)).toBe(false)
      expect(definition.isCorrect!(trial, null)).toBe(false)
      expect(definition.isCorrect!(trial, 'gleich')).toBe(false)
    }
  })

  it('describes itself the way the catalogue expects', () => {
    expect(definition.slug).toBe('zeichenvergleich')
    expect(definition.construct).toBe('konzentration')
    expect(definition.mode).toBe('sprint')
    expect(definition.defaultDurationS).toBe(90)
    expect(definition.difficultyRange).toEqual([1, 6])
    expect(definition.thresholds).toEqual({ raw1: 8, raw4: 26, raw6: 50 })
    expect(definition.blurb).not.toMatch(/ß|—|–/)
    expect(definition.name).toBe('Zeichenvergleich')
  })
})
