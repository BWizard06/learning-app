import { describe, expect, it } from 'vitest'
import { createRng } from '~~/shared/rng'
import { runGeneratorContract } from '~~/shared/testing/generator-contract'
import { propertyRuns } from '~~/shared/testing/property'
import definition from './definition'
import {
  GROUP_MARK,
  ITEM_TYPES,
  MISTAKE_KINDS,
  MIXED_FORMS,
  OPTION_COUNT,
  generateEstimate,
  type EstimatePayload,
} from './generator'

interface StoredOption {
  kind: string
  value: number
}

interface Params {
  type: string
  form?: string
  a?: number
  b?: number
  c?: number
  percent?: number
  base?: number
  dividend?: number
  divisor?: number
  quotient?: number
  terms?: number[]
  value: number
  options: StoredOption[]
  correctIndex: number
}

function parse(params: unknown): Params {
  return params as unknown as Params
}

function addTimes(value: number, count: number): number {
  let total = 0
  for (let i = 0; i < count; i++) total += value
  return total
}

function slowMultiply(a: number, b: number): number {
  const digits = [...String(b)].reverse()
  let total = 0
  let place = a
  for (const digit of digits) {
    total += addTimes(place, Number(digit))
    place = addTimes(place, 10)
  }
  return total
}

function columnSum(values: readonly number[]): number {
  const columns: number[] = []
  for (const value of values) {
    const digits = [...String(value)].reverse()
    for (let i = 0; i < digits.length; i++) {
      columns[i] = (columns[i] ?? 0) + Number(digits[i])
    }
  }
  let carry = 0
  let out = ''
  for (let i = 0; i < columns.length; i++) {
    const total = columns[i]! + carry
    const digit = total % 10
    out = String(digit) + out
    carry = (total - digit) / 10
  }
  while (carry > 0) {
    const digit = carry % 10
    out = String(digit) + out
    carry = (carry - digit) / 10
  }
  return Number(out)
}

const BAND_TABLE: readonly (readonly [string, number, number])[] = [
  ['kommastelle-hoch', 90, 110],
  ['faktor-zehn-hoch', 9, 11],
  ['knapp-daneben', 1.015, 1.16],
  ['knapp-daneben', 0.84, 0.985],
  ['faktor-zehn-tief', 0.09, 0.11],
  ['kommastelle-tief', 0.009, 0.011],
]

function bandFor(ratio: number): string | null {
  for (const entry of BAND_TABLE) {
    if (ratio >= entry[1] && ratio <= entry[2]) return entry[0]
  }
  return null
}

function checkValue(params: Params): void {
  const value = params.value
  switch (params.type) {
    case 'multiplikation':
      expect(value).toBe(slowMultiply(params.a!, params.b!))
      break
    case 'division':
      expect(value).toBe(params.quotient!)
      expect(slowMultiply(params.divisor!, value)).toBe(params.dividend!)
      break
    case 'prozent':
      expect(params.base! % 100).toBe(0)
      expect(addTimes(value, 100)).toBe(slowMultiply(params.base!, params.percent!))
      break
    case 'summe':
      expect(value).toBe(columnSum(params.terms!))
      break
    case 'gemischt':
      if (params.form === 'summe-mal') {
        expect(value).toBe(slowMultiply(columnSum([params.a!, params.b!]), params.c!))
      } else if (params.form === 'produkt-plus') {
        expect(value).toBe(columnSum([slowMultiply(params.a!, params.b!), params.c!]))
      } else {
        expect(columnSum([value, params.c!])).toBe(slowMultiply(params.a!, params.b!))
      }
      break
    default:
      throw new Error(`unbekannter Typ ${params.type}`)
  }
}

function checkInverse(params: Params, inverse: number): void {
  switch (params.type) {
    case 'multiplikation':
      expect(Math.abs(slowMultiply(inverse, params.b!) - params.a!) * 2).toBeLessThanOrEqual(params.b!)
      break
    case 'division':
      expect(inverse).toBe(slowMultiply(params.dividend!, params.divisor!))
      break
    case 'prozent': {
      const hundredfold = addTimes(addTimes(params.base!, 10), 10)
      expect(Math.abs(slowMultiply(inverse, params.percent!) - hundredfold) * 2).toBeLessThanOrEqual(
        params.percent!,
      )
      break
    }
    case 'summe': {
      const terms = [...params.terms!]
      const largest = Math.max(...terms)
      terms.splice(terms.indexOf(largest), 1)
      expect(columnSum([inverse, ...terms])).toBe(largest)
      break
    }
    case 'gemischt':
      if (params.form === 'summe-mal') {
        const total = columnSum([params.a!, params.b!])
        expect(Math.abs(slowMultiply(inverse, params.c!) - total) * 2).toBeLessThanOrEqual(params.c!)
      } else if (params.form === 'produkt-plus') {
        expect(columnSum([inverse, params.c!])).toBe(slowMultiply(params.a!, params.b!))
      } else {
        expect(inverse).toBe(columnSum([slowMultiply(params.a!, params.b!), params.c!]))
      }
      break
    default:
      throw new Error(`unbekannter Typ ${params.type}`)
  }
}

function statisticalRuns(): number {
  return Math.max(2000, propertyRuns())
}

describe('ueberschlag generator', () => {
  it('satisfies the shared generator contract', () => {
    runGeneratorContract(definition, {
      expectIntegerAnswer: true,
      minItemTypes: ITEM_TYPES.length,
      checkTrial: (trial) => {
        const payload = trial.payload as EstimatePayload
        expect(payload.expression.length).toBeGreaterThan(0)
        expect(payload.question.length).toBeGreaterThan(0)
        expect(payload.expression).not.toContain('ß')
        expect(payload.question).not.toContain('ß')
        expect(trial.options).toHaveLength(OPTION_COUNT)
        expect(trial.answer).toBe(trial.correctIndex)
      },
    })
  })

  it('computes the correct option with an independent calculation', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const trial = generateEstimate((i % 6) + 1, createRng(i * 2654435761 + 13))
      const params = parse(trial.params)
      const solution = params.options[params.correctIndex]!

      checkValue(params)
      expect(solution.kind).toBe('richtig')
      expect(solution.value).toBe(params.value)
      expect(params.value).toBeGreaterThanOrEqual(100)
      expect(trial.options![params.correctIndex]!.label).toBe(
        String(params.value).replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_MARK),
      )
    }
  })

  it('gives every distractor the value its declared mistake produces', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const trial = generateEstimate((i % 6) + 1, createRng(i * 104729 + 29))
      const params = parse(trial.params)
      const truth = params.value

      let solutions = 0
      let nearMisses = 0
      const kinds = new Set<string>()

      for (const option of params.options) {
        kinds.add(option.kind)
        const ratio = option.value / truth

        if (option.kind === 'richtig') {
          solutions++
          expect(option.value).toBe(truth)
          expect(bandFor(ratio)).toBeNull()
          continue
        }

        expect(MISTAKE_KINDS as readonly string[]).toContain(option.kind)
        expect(Number.isInteger(option.value)).toBe(true)
        expect(option.value).toBeGreaterThan(0)

        if (option.kind === 'umkehroperation') {
          expect(bandFor(ratio), `Umkehrung liegt im Band ${bandFor(ratio)}`).toBeNull()
          checkInverse(params, option.value)
          continue
        }

        if (option.kind === 'knapp-daneben') {
          nearMisses++
          expect(Math.abs(ratio - 1)).toBeLessThanOrEqual(0.16)
          expect(Math.abs(ratio - 1)).toBeGreaterThanOrEqual(0.015)
        }

        expect(bandFor(ratio), `${option.kind} traegt das Verhaeltnis ${ratio}`).toBe(option.kind)
      }

      expect(solutions).toBe(1)
      expect(nearMisses).toBe(1)
      expect(kinds.size).toBe(OPTION_COUNT)
    }
  })

  it('keeps all five option values and labels distinct', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const trial = generateEstimate((i % 6) + 1, createRng(i * 40503 + 7))
      const params = parse(trial.params)

      expect(params.options).toHaveLength(OPTION_COUNT)
      expect(trial.options).toHaveLength(OPTION_COUNT)
      expect(new Set(params.options.map((option) => option.value)).size).toBe(OPTION_COUNT)
      expect(new Set(trial.options!.map((option) => option.label)).size).toBe(OPTION_COUNT)
      expect(trial.options!.map((option) => option.label)).toEqual(
        params.options.map((option) => String(option.value).replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_MARK)),
      )
      for (const option of trial.options!) {
        expect(option.label).toMatch(new RegExp(`^\\d{1,3}(${GROUP_MARK}\\d{3})*$`))
      }
    }
  })

  it('reaches every task format and every mistake at the lowest difficulty', () => {
    const runs = statisticalRuns()
    const types = new Set<string>()
    const forms = new Set<string>()
    const kinds = new Set<string>()

    for (let i = 0; i < runs; i++) {
      const trial = generateEstimate(1, createRng(i * 2246822519 + 5))
      const params = parse(trial.params)
      types.add(trial.itemType)
      if (params.form) forms.add(params.form)
      for (const option of params.options) {
        if (option.kind !== 'richtig') kinds.add(option.kind)
      }
    }

    expect([...types].sort()).toEqual([...ITEM_TYPES].sort())
    expect([...forms].sort()).toEqual([...MIXED_FORMS].sort())
    expect([...kinds].sort()).toEqual([...MISTAKE_KINDS].sort())
  })

  it('reaches every task format at every difficulty', () => {
    for (let difficulty = 1; difficulty <= 6; difficulty++) {
      const types = new Set<string>()
      const forms = new Set<string>()
      for (let i = 0; i < 1200; i++) {
        const trial = generateEstimate(difficulty, createRng(i * 97 + difficulty * 7919))
        types.add(trial.itemType)
        const params = parse(trial.params)
        if (params.form) forms.add(params.form)
      }
      expect([...types].sort(), `Stufe ${difficulty}`).toEqual([...ITEM_TYPES].sort())
      expect([...forms].sort(), `Stufe ${difficulty}`).toEqual([...MIXED_FORMS].sort())
    }
  })

  it('spreads the correct option evenly over the five positions', () => {
    const runs = statisticalRuns()
    const counts = new Array<number>(OPTION_COUNT).fill(0)
    for (let i = 0; i < runs; i++) {
      const trial = generateEstimate((i % 6) + 1, createRng(i * 3266489917 + 19))
      counts[trial.correctIndex!] = counts[trial.correctIndex!]! + 1
    }
    for (let position = 0; position < OPTION_COUNT; position++) {
      const share = counts[position]! / runs
      expect(share, `Position ${position} traegt ${(share * 100).toFixed(1)} Prozent`).toBeGreaterThan(0.14)
      expect(share, `Position ${position} traegt ${(share * 100).toFixed(1)} Prozent`).toBeLessThan(0.26)
    }
  })

  it('does not park the correct option at the largest or the smallest value', () => {
    const runs = statisticalRuns()
    const counts = new Map<number, number>()
    for (let i = 0; i < runs; i++) {
      const trial = generateEstimate((i % 6) + 1, createRng(i * 1597334677 + 31))
      const params = parse(trial.params)
      const smaller = params.options.filter((option) => option.value < params.value).length
      counts.set(smaller + 1, (counts.get(smaller + 1) ?? 0) + 1)
    }

    let mean = 0
    for (let rank = 1; rank <= OPTION_COUNT; rank++) {
      const count = counts.get(rank) ?? 0
      expect(count, `Rang ${rank} kommt nie vor`).toBeGreaterThan(0)
      expect(count / runs, `Rang ${rank} traegt zu viel`).toBeLessThan(0.45)
      mean += (rank * count) / runs
    }
    expect((counts.get(1) ?? 0) / runs).toBeLessThan(0.3)
    expect((counts.get(OPTION_COUNT) ?? 0) / runs).toBeLessThan(0.3)
    expect(mean).toBeGreaterThan(2.2)
    expect(mean).toBeLessThan(3.8)
  })

  it('moves the near miss closer to the truth as difficulty rises', () => {
    const distance = (difficulty: number) => {
      let total = 0
      let seen = 0
      for (let i = 0; i < 600; i++) {
        const trial = generateEstimate(difficulty, createRng(i * 131 + difficulty * 104729))
        const params = parse(trial.params)
        const near = params.options.find((option) => option.kind === 'knapp-daneben')!
        total += Math.abs(near.value / params.value - 1)
        seen++
      }
      return total / seen
    }

    const distances = [1, 2, 3, 4, 5, 6].map((difficulty) => distance(difficulty))
    for (let i = 1; i < distances.length; i++) {
      expect(distances[i], `Stufe ${i + 1} liegt nicht naeher als Stufe ${i}`).toBeLessThan(distances[i - 1]!)
    }
  })

  it('grows the operands with difficulty', () => {
    const magnitude = (difficulty: number) => {
      let total = 0
      for (let i = 0; i < 600; i++) {
        const trial = generateEstimate(difficulty, createRng(i * 31 + difficulty))
        total += parse(trial.params).value
      }
      return total / 600
    }

    const sizes = [1, 2, 3, 4, 5, 6].map((difficulty) => magnitude(difficulty))
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i], `Stufe ${i + 1} rechnet nicht groesser als Stufe ${i}`).toBeGreaterThan(sizes[i - 1]!)
    }
  })

  it('renders the same numbers in the expression that params describe', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const trial = generateEstimate((i % 6) + 1, createRng(i * 22695477 + 3))
      const params = parse(trial.params)
      const payload = trial.payload as EstimatePayload
      const shown = payload.expression
        .split(/[^0-9’]+/)
        .filter((part) => part.length > 0)
        .map((part) => Number(part.split(GROUP_MARK).join('')))

      const expected =
        params.type === 'summe'
          ? [...params.terms!]
          : params.type === 'multiplikation'
            ? [params.a!, params.b!]
            : params.type === 'division'
              ? [params.dividend!, params.divisor!]
              : params.type === 'prozent'
                ? [params.percent!, params.base!]
                : [params.a!, params.b!, params.c!]

      expect(shown).toEqual(expected)
      expect(payload.expression).not.toContain(String.fromCharCode(0x2013))
      expect(payload.expression).not.toContain(String.fromCharCode(0x2014))
    }
  })
})

describe('ueberschlag scoring', () => {
  const result = (correct: boolean, difficulty: number, response = 0, kind = 'richtig') => ({
    idx: 0,
    itemType: 'multiplikation',
    difficulty,
    params: { options: [{ kind, value: 100 }] },
    response,
    correct,
    rtMs: 2400,
    presentedAt: 0,
  })

  it('rewards the same accuracy at higher difficulty', () => {
    const easy = definition.score([result(true, 1), result(true, 1), result(false, 1)], 60)
    const hard = definition.score([result(true, 6), result(true, 6), result(false, 6)], 60)
    expect(easy.accuracy).toBe(hard.accuracy)
    expect(hard.raw).toBeGreaterThan(easy.raw)
  })

  it('counts which kind of mistake the player fell for', () => {
    const score = definition.score(
      [
        result(false, 3, 0, 'faktor-zehn-hoch'),
        result(false, 3, 0, 'faktor-zehn-tief'),
        result(false, 3, 0, 'kommastelle-tief'),
        result(false, 3, 0, 'knapp-daneben'),
        result(false, 3, 0, 'umkehroperation'),
        result(true, 3, 0, 'richtig'),
      ],
      60,
    )
    expect(score.metrics.zehnerfehler).toBe(2)
    expect(score.metrics.kommafehler).toBe(1)
    expect(score.metrics.knappfehler).toBe(1)
    expect(score.metrics.umkehrfehler).toBe(1)
    expect(score.metrics.attempted).toBe(6)
    expect(score.metrics.correct).toBe(1)
  })

  it('reports zero for an empty session without throwing', () => {
    const score = definition.score([], 60)
    expect(score.raw).toBe(0)
    expect(score.accuracy).toBe(0)
    expect(score.metrics.medianRtMs).toBe(0)
  })
})
