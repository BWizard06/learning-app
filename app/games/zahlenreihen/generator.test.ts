import { describe, expect, it } from 'vitest'
import { createRng } from '~~/shared/rng'
import { runGeneratorContract } from '~~/shared/testing/generator-contract'
import { propertyRuns } from '~~/shared/testing/property'
import definition from './definition'
import {
  ITEM_TYPES,
  VALUE_LIMIT,
  generateSequence,
  negativesAllowed,
  tierOf,
  type ItemType,
  type SequencePayload,
  type SequenceTrial,
} from './generator'

const EASY_TYPES: ItemType[] = [
  'alternierende-schritte',
  'konstante-differenz',
  'konstanter-faktor',
]

const MIN_TERMS: Record<ItemType, number> = {
  'konstante-differenz': 5,
  'konstanter-faktor': 5,
  'alternierende-schritte': 6,
  'zweite-differenz': 6,
  'differenzreihe': 6,
  'verschachtelt': 6,
  'fibonacci-artig': 6,
  'quadratzahlen-versatz': 6,
  'kubikzahlen-versatz': 5,
  'mult-add-wechsel': 6,
  'mult-plus-konstante': 5,
  'primzahl-versatz': 6,
}

function sievePrimes(limit: number): number[] {
  const composite = new Array<boolean>(limit + 1).fill(false)
  const primes: number[] = []
  for (let n = 2; n <= limit; n++) {
    if (composite[n]) continue
    primes.push(n)
    for (let m = n * n; m <= limit; m += n) composite[m] = true
  }
  return primes
}

const PRIMES = sievePrimes(1000)

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y !== 0) {
    const t = y
    y = x % y
    x = t
  }
  return x === 0 ? 1 : x
}

function arithmeticFits(terms: readonly number[]): boolean {
  if (terms.length < 3) return false
  const steps = new Set<number>()
  for (let i = 1; i < terms.length; i++) steps.add(terms[i]! - terms[i - 1]!)
  return steps.size === 1
}

function geometricFits(terms: readonly number[]): boolean {
  if (terms.length < 3) return false
  if (terms.some((term) => term === 0)) return false
  const ratios = new Set<string>()
  for (let i = 1; i < terms.length; i++) {
    const top = terms[i]!
    const bottom = terms[i - 1]!
    const divisor = gcd(top, bottom)
    const numerator = top / divisor
    const denominator = bottom / divisor
    ratios.add(denominator < 0 ? `${-numerator}/${-denominator}` : `${numerator}/${denominator}`)
  }
  return ratios.size === 1
}

function deltas(values: readonly number[]): number[] {
  const out: number[] = []
  for (let i = 1; i < values.length; i++) out.push(values[i]! - values[i - 1]!)
  return out
}

function constantRun(values: readonly number[]): boolean {
  return values.length > 0 && new Set(values).size === 1
}

function alternatingFit(terms: readonly number[]): number | null {
  if (terms.length < 5) return null
  const steps = deltas(terms)
  for (let i = 0; i < steps.length; i++) {
    if (steps[i]! !== (i % 2 === 0 ? steps[0]! : steps[1]!)) return null
  }
  return terms[terms.length - 1]! + (steps.length % 2 === 0 ? steps[0]! : steps[1]!)
}

function interleavedArithmetic(values: readonly number[]): boolean {
  const even = values.filter((_, i) => i % 2 === 0)
  const odd = values.filter((_, i) => i % 2 === 1)
  if (even.length < 3 || odd.length < 3) return false
  return constantRun(deltas(even)) && constantRun(deltas(odd))
}

function fibonacciShape(values: readonly number[]): boolean {
  if (values.length < 3) return false
  for (let i = 2; i < values.length; i++) {
    if (values[i]! !== values[i - 1]! + values[i - 2]!) return false
  }
  return true
}

function affineRecurrence(values: readonly number[]): { factor: number; addend: number } | null {
  if (values.length < 4) return null
  const den = values[1]! - values[0]!
  if (den === 0) return null
  const factorNum = values[2]! - values[1]!
  const addendNum = values[1]! * den - factorNum * values[0]!
  for (let i = 0; i + 1 < values.length; i++) {
    if (values[i + 1]! * den !== factorNum * values[i]! + addendNum) return null
  }
  if (factorNum % den !== 0 || addendNum % den !== 0) return null
  return { factor: factorNum / den, addend: addendNum / den }
}

function multiplyAddShape(values: readonly number[]): boolean {
  for (const multiplyFirst of [true, false]) {
    let factor: number | null = null
    let addend: number | null = null
    let ok = true
    for (let i = 0; i + 1 < values.length; i++) {
      if ((i % 2 === 0) === multiplyFirst) {
        if (values[i]! === 0 || values[i + 1]! % values[i]! !== 0) {
          ok = false
          break
        }
        const seen = values[i + 1]! / values[i]!
        if (factor === null) factor = seen
        else if (factor !== seen) {
          ok = false
          break
        }
      } else {
        const seen = values[i + 1]! - values[i]!
        if (addend === null) addend = seen
        else if (addend !== seen) {
          ok = false
          break
        }
      }
    }
    if (ok && factor !== null && addend !== null && factor >= 2 && addend !== 0) return true
  }
  return false
}

function consecutivePowersPlusOffset(values: readonly number[], exponent: number): boolean {
  for (let from = 0; from <= 60; from++) {
    const offset = values[0]! - from ** exponent
    if (values.every((value, i) => value - offset === (from + i) ** exponent)) return true
  }
  return false
}

function consecutivePrimesPlusOffset(values: readonly number[]): boolean {
  for (let k = 0; k + values.length <= PRIMES.length; k++) {
    const offset = values[0]! - PRIMES[k]!
    if (values.every((value, i) => value - offset === PRIMES[k + i]!)) return true
  }
  return false
}

const STRUCTURE: Record<ItemType, (values: number[]) => boolean> = {
  'konstante-differenz': (values) => constantRun(deltas(values)),
  'konstanter-faktor': (values) => geometricFits(values),
  'alternierende-schritte': (values) => {
    const steps = deltas(values)
    return alternatingFit(values) !== null && steps[0]! !== steps[1]!
  },
  'zweite-differenz': (values) => constantRun(deltas(deltas(values))),
  'differenzreihe': (values) =>
    constantRun(deltas(deltas(values))) && deltas(values)[0] === deltas(deltas(values))[0],
  'verschachtelt': (values) => interleavedArithmetic(values),
  'fibonacci-artig': (values) => fibonacciShape(values),
  'quadratzahlen-versatz': (values) => consecutivePowersPlusOffset(values, 2),
  'kubikzahlen-versatz': (values) => consecutivePowersPlusOffset(values, 3),
  'mult-add-wechsel': (values) => multiplyAddShape(values),
  'mult-plus-konstante': (values) => {
    const fit = affineRecurrence(values)
    return fit !== null && fit.factor >= 2 && fit.addend !== 0
  },
  'primzahl-versatz': (values) => consecutivePrimesPlusOffset(values),
}

function secondDifferenceFit(terms: readonly number[]): number | null {
  if (terms.length < 5) return null
  const steps: number[] = []
  for (let i = 1; i < terms.length; i++) steps.push(terms[i]! - terms[i - 1]!)
  const seconds: number[] = []
  for (let i = 1; i < steps.length; i++) seconds.push(steps[i]! - steps[i - 1]!)
  if (new Set(seconds).size !== 1) return null
  return terms[terms.length - 1]! + steps[steps.length - 1]! + seconds[0]!
}

function payloadOf(trial: SequenceTrial): SequencePayload {
  return trial.payload
}

function rebuild(trial: SequenceTrial): number[] {
  const p = trial.params as Record<string, number>
  const shown = p.shown!
  const values: number[] = []

  switch (trial.itemType as ItemType) {
    case 'konstante-differenz':
      for (let i = 0; i <= shown; i++) values.push(p.start! + i * p.step!)
      return values

    case 'konstanter-faktor':
      for (let i = 0; i <= shown; i++) values.push(p.start! * p.factor! ** i)
      return values

    case 'alternierende-schritte':
      for (let i = 0; i <= shown; i++) {
        values.push(p.start! + Math.ceil(i / 2) * p.stepA! + Math.floor(i / 2) * p.stepB!)
      }
      return values

    case 'zweite-differenz':
      for (let i = 0; i <= shown; i++) {
        values.push(p.start! + i * p.firstStep! + (p.increment! * i * (i - 1)) / 2)
      }
      return values

    case 'differenzreihe':
      for (let i = 0; i <= shown; i++) values.push(p.start! + (p.unit! * i * (i + 1)) / 2)
      return values

    case 'verschachtelt':
      for (let i = 0; i <= shown; i++) {
        values.push(
          i % 2 === 0 ? p.startA! + (i / 2) * p.stepA! : p.startB! + ((i - 1) / 2) * p.stepB!,
        )
      }
      return values

    case 'fibonacci-artig':
      values.push(p.first!, p.second!)
      for (let i = 2; i <= shown; i++) values.push(values[i - 1]! + values[i - 2]!)
      return values

    case 'quadratzahlen-versatz':
      for (let i = 0; i <= shown; i++) values.push((p.from! + i) ** 2 + p.offset!)
      return values

    case 'kubikzahlen-versatz':
      for (let i = 0; i <= shown; i++) values.push((p.from! + i) ** 3 + p.offset!)
      return values

    case 'mult-add-wechsel':
      values.push(p.start!)
      for (let i = 0; i < shown; i++) {
        const multiply = (i % 2 === 0) === (p.multiplyFirst === 1)
        values.push(multiply ? values[i]! * p.factor! : values[i]! + p.addend!)
      }
      return values

    case 'mult-plus-konstante':
      values.push(p.start!)
      for (let i = 0; i < shown; i++) values.push(values[i]! * p.factor! + p.addend!)
      return values

    case 'primzahl-versatz':
      for (let i = 0; i <= shown; i++) values.push(PRIMES[p.fromIndex! + i]! + p.offset!)
      return values
  }
}

describe('zahlenreihen generator', () => {
  it('satisfies the shared generator contract', () => {
    runGeneratorContract(definition, {
      expectIntegerAnswer: true,
      minItemTypes: ITEM_TYPES.length,
      answerRange: [-VALUE_LIMIT, VALUE_LIMIT],
      checkTrial: (trial) => {
        const payload = trial.payload as SequencePayload
        expect(Array.isArray(payload.terms)).toBe(true)
        expect(payload.terms.length).toBeGreaterThanOrEqual(5)
        expect(typeof payload.allowNegative).toBe('boolean')
      },
    })
  })

  it('keeps every term and the answer whole and inside the value limit', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const difficulty = (i % 12) + 1
      const trial = generateSequence(difficulty, createRng(i * 2654435761 + 11))
      const values = [...payloadOf(trial).terms, trial.answer]
      for (const value of values) {
        expect(Number.isInteger(value)).toBe(true)
        expect(Math.abs(value)).toBeLessThanOrEqual(VALUE_LIMIT)
        if (!negativesAllowed(difficulty)) expect(value).toBeGreaterThanOrEqual(0)
      }
      expect(payloadOf(trial).allowNegative).toBe(negativesAllowed(difficulty))
    }
  })

  it('shows enough terms for the rule to be readable', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const difficulty = (i % 12) + 1
      const trial = generateSequence(difficulty, createRng(i * 999983 + 5))
      const terms = payloadOf(trial).terms
      expect(terms.length).toBeGreaterThanOrEqual(MIN_TERMS[trial.itemType as ItemType])
    }
  })

  it('never shows terms that a constant difference or a constant factor also explains', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const difficulty = (i % 12) + 1
      const trial = generateSequence(difficulty, createRng(i * 40503 + 7))
      const terms = payloadOf(trial).terms

      if (arithmeticFits(terms)) {
        expect(trial.itemType, `arithmetic fit on ${terms.join(', ')}`).toBe('konstante-differenz')
      }
      if (geometricFits(terms)) {
        expect(trial.itemType, `geometric fit on ${terms.join(', ')}`).toBe('konstanter-faktor')
      }
    }
  })

  it('never shows terms where a constant second difference points elsewhere', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const difficulty = (i % 12) + 1
      const trial = generateSequence(difficulty, createRng(i * 15485863 + 13))
      const predicted = secondDifferenceFit(payloadOf(trial).terms)
      if (predicted !== null) expect(predicted).toBe(trial.answer)
    }
  })

  it('never shows terms where two alternating steps point elsewhere', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const difficulty = (i % 12) + 1
      const trial = generateSequence(difficulty, createRng(i * 2971215073 + 29))
      const predicted = alternatingFit(payloadOf(trial).terms)
      if (predicted !== null) {
        expect(predicted, `alternating fit on ${payloadOf(trial).terms.join(', ')}`).toBe(
          trial.answer,
        )
      }
    }
  })

  it('matches the structure its own item type promises without reading the parameters', () => {
    const runs = propertyRuns()
    const seen = new Set<ItemType>()
    for (let i = 0; i < runs; i++) {
      const difficulty = (i % 12) + 1
      const trial = generateSequence(difficulty, createRng(i * 1103515245 + 31))
      const itemType = trial.itemType as ItemType
      const values = [...payloadOf(trial).terms, trial.answer]
      seen.add(itemType)
      expect(STRUCTURE[itemType](values), `${itemType} on ${values.join(', ')}`).toBe(true)
    }
    expect([...seen].sort()).toEqual([...ITEM_TYPES].sort())
  })

  it('reproduces the shown terms and the answer from the stated rule', () => {
    const runs = propertyRuns()
    const seen = new Set<ItemType>()
    for (let i = 0; i < runs; i++) {
      const difficulty = (i % 12) + 1
      const trial = generateSequence(difficulty, createRng(i * 104729 + 17))
      const values = rebuild(trial)
      seen.add(trial.itemType as ItemType)

      expect(values.length, `${trial.itemType} rebuilt length`).toBe(
        payloadOf(trial).terms.length + 1,
      )
      expect(values.slice(0, values.length - 1), `${trial.itemType} terms`).toEqual(
        payloadOf(trial).terms,
      )
      expect(values[values.length - 1], `${trial.itemType} answer`).toBe(trial.answer)
      expect((trial.params as Record<string, string>).type).toBe(trial.itemType)
    }
    expect([...seen].sort()).toEqual([...ITEM_TYPES].sort())
  })

  it('offers only the three simple rules at low difficulty', () => {
    for (let difficulty = 1; difficulty <= 3; difficulty++) {
      expect(tierOf(difficulty)).toBe(0)
      const seen = new Set<string>()
      for (let i = 0; i < 900; i++) {
        seen.add(generateSequence(difficulty, createRng(i * 97 + difficulty)).itemType)
      }
      expect([...seen].sort()).toEqual([...EASY_TYPES].sort())
    }
  })

  it('widens the rule pool and the step size as difficulty rises', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 4000; i++) {
      seen.add(generateSequence(12, createRng(i * 131 + 3)).itemType)
    }
    expect(seen.size).toBe(ITEM_TYPES.length)

    const meanStep = (difficulty: number) => {
      let total = 0
      let count = 0
      for (let i = 0; i < 3000; i++) {
        const trial = generateSequence(difficulty, createRng(i * 31 + difficulty))
        if (trial.itemType !== 'konstante-differenz') continue
        total += Math.abs((trial.params as Record<string, number>).step!)
        count++
      }
      expect(count).toBeGreaterThan(0)
      return total / count
    }
    expect(meanStep(11)).toBeGreaterThan(meanStep(2))
  })

  it('produces negative terms once the difficulty allows them', () => {
    let negatives = 0
    for (let i = 0; i < 2000; i++) {
      const trial = generateSequence(9, createRng(i * 7919 + 23))
      if ([...payloadOf(trial).terms, trial.answer].some((value) => value < 0)) negatives++
    }
    expect(negatives).toBeGreaterThan(0)
  })
})

describe('zahlenreihen scoring', () => {
  const result = (correct: boolean, difficulty: number, rtMs = 4000) => ({
    idx: 0,
    itemType: 'konstante-differenz',
    difficulty,
    params: {},
    response: 1,
    correct,
    rtMs,
    presentedAt: 0,
  })

  it('rewards the same accuracy at higher difficulty', () => {
    const easy = definition.score(
      [result(true, 1), result(true, 1), result(true, 1), result(false, 1)],
      60,
    )
    const hard = definition.score(
      [result(true, 12), result(true, 12), result(true, 12), result(false, 12)],
      60,
    )
    expect(easy.accuracy).toBe(hard.accuracy)
    expect(hard.raw).toBeGreaterThan(easy.raw)
  })

  it('reports zero for an empty session without throwing', () => {
    const score = definition.score([], 60)
    expect(score.raw).toBe(0)
    expect(score.accuracy).toBe(0)
    expect(score.metrics.attempted).toBe(0)
  })
})
