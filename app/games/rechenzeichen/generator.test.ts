import { describe, expect, it } from 'vitest'
import { createRng } from '~~/shared/rng'
import { runGeneratorContract } from '~~/shared/testing/generator-contract'
import { propertyRuns } from '~~/shared/testing/property'
import definition from './definition'
import {
  BLANKS_BY_TYPE,
  FALLBACKS,
  ITEM_TYPES,
  OPERATORS,
  evaluateIntegral,
  generateRechenzeichen,
  type ItemType,
  type Operator,
} from './generator'

type Frac = [number, number]

function reduceFrac(n: number, d: number): Frac {
  const sign = d < 0 ? -1 : 1
  let a = Math.abs(n)
  let b = Math.abs(d)
  while (b !== 0) {
    const t = b
    b = a % b
    a = t
  }
  const g = a || 1
  return [(sign * n) / g, (sign * d) / g]
}

function addFrac(a: Frac, b: Frac): Frac {
  return reduceFrac(a[0] * b[1] + b[0] * a[1], a[1] * b[1])
}

function subFrac(a: Frac, b: Frac): Frac {
  return reduceFrac(a[0] * b[1] - b[0] * a[1], a[1] * b[1])
}

function mulFrac(a: Frac, b: Frac): Frac {
  return reduceFrac(a[0] * b[0], a[1] * b[1])
}

function divFrac(a: Frac, b: Frac): Frac {
  return reduceFrac(a[0] * b[1], a[1] * b[0])
}

function readTerm(
  operands: readonly number[],
  ops: readonly string[],
  start: number,
  trace: Frac[] | null,
): { value: Frac; end: number } {
  let value: Frac = [operands[start]!, 1]
  let i = start
  while (i < ops.length && (ops[i] === '*' || ops[i] === ':')) {
    const rhs: Frac = [operands[i + 1]!, 1]
    value = ops[i] === '*' ? mulFrac(value, rhs) : divFrac(value, rhs)
    trace?.push(value)
    i++
  }
  return { value, end: i }
}

function evalExact(operands: readonly number[], ops: readonly string[], trace: Frac[] | null = null): Frac {
  const head = readTerm(operands, ops, 0, trace)
  let total = head.value
  trace?.push(total)
  let i = head.end
  while (i < ops.length) {
    const op = ops[i]
    const rest = readTerm(operands, ops, i + 1, trace)
    total = op === '+' ? addFrac(total, rest.value) : subFrac(total, rest.value)
    trace?.push(total)
    i = rest.end
  }
  return total
}

function traceOf(operands: readonly number[], ops: readonly string[]): Frac[] {
  const trace: Frac[] = []
  evalExact(operands, ops, trace)
  return trace
}

function allTuples(blanks: number): Operator[][] {
  let list: Operator[][] = [[]]
  for (let i = 0; i < blanks; i++) {
    const grown: Operator[][] = []
    for (const prefix of list) {
      for (const op of OPERATORS) grown.push([...prefix, op])
    }
    list = grown
  }
  return list
}

function winnersFor(operands: readonly number[], blanks: number, target: number): Operator[][] {
  return allTuples(blanks).filter((tuple) => {
    const value = evalExact(operands, tuple)
    return value[1] === 1 && value[0] === target
  })
}

function readOperands(trial: { params: Record<string, unknown> }): number[] {
  return trial.params.operands as number[]
}

function readOps(trial: { params: Record<string, unknown> }): string[] {
  return trial.params.ops as string[]
}

const PRECEDENCE_TABLE: { operands: number[]; ops: Operator[]; value: number }[] = [
  { operands: [6, 3, 2], ops: ['+', '*'], value: 12 },
  { operands: [6, 3, 2], ops: ['*', '+'], value: 20 },
  { operands: [24, 6, 2], ops: [':', '-'], value: 2 },
  { operands: [2, 3, 4, 5], ops: ['+', '*', '-'], value: 9 },
  { operands: [6, 3, 2], ops: ['-', '*'], value: 0 },
  { operands: [8, 4, 2], ops: [':', ':'], value: 1 },
  { operands: [2, 3, 4, 5], ops: ['*', '+', '*'], value: 26 },
  { operands: [10, 2, 3, 1], ops: ['-', '*', '+'], value: 5 },
  { operands: [7, 8, 2], ops: ['+', ':'], value: 11 },
  { operands: [3, 4, 6], ops: ['*', ':'], value: 2 },
  { operands: [5, 4, 3], ops: ['-', '+'], value: 4 },
  { operands: [2, 3, 4, 5], ops: ['+', '*', '*'], value: 62 },
]

describe('rechenzeichen evaluator', () => {
  it('applies point before line exactly as written by hand', () => {
    for (const row of PRECEDENCE_TABLE) {
      const evaluation = evaluateIntegral(row.operands, row.ops)
      expect(evaluation, `${row.operands.join(' ')} with ${row.ops.join('')}`).not.toBeNull()
      expect(evaluation!.value, `${row.operands.join(' ')} with ${row.ops.join('')}`).toBe(row.value)
    }
  })

  it('matches the independent rational evaluator on the hand written table', () => {
    for (const row of PRECEDENCE_TABLE) {
      expect(evalExact(row.operands, row.ops)).toEqual([row.value, 1])
    }
  })

  it('rejects inexact division and negative running values', () => {
    expect(evaluateIntegral([7, 2], [':'])).toBeNull()
    expect(evaluateIntegral([3, 5], ['-'])).toBeNull()
    expect(evaluateIntegral([2, 3, 5], ['-', '+'])).toBeNull()
    expect(evaluateIntegral([9, 2, 3], [':', '*'])).toBeNull()
    expect(evaluateIntegral([6, 3], ['-'])!.value).toBe(3)
  })
})

describe('rechenzeichen generator', () => {
  it('satisfies the shared generator contract', () => {
    runGeneratorContract(definition, {
      minItemTypes: ITEM_TYPES.length,
      checkTrial: (trial) => {
        const operands = trial.params.operands as number[]
        const ops = trial.params.ops as string[]
        const payload = trial.payload as { operands: number[]; target: number; blanks: number }
        expect(ops.length).toBe(BLANKS_BY_TYPE[trial.itemType as ItemType])
        expect(operands.length).toBe(ops.length + 1)
        expect(payload.operands).toEqual(operands)
        expect(payload.blanks).toBe(ops.length)
        expect(payload.target).toBe(trial.params.target)
        expect(trial.answer).toEqual(ops)
      },
    })
  })

  it('admits exactly one operator combination for every generated item', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const difficulty = (i % 6) + 1
      const trial = generateRechenzeichen(difficulty, createRng(i * 2654435761 + 11))
      const operands = readOperands(trial)
      const ops = readOps(trial)
      const target = trial.params.target as number
      const winners = winnersFor(operands, ops.length, target)
      const label = `${operands.join(' _ ')} = ${target}`
      expect(winners.length, label).toBe(1)
      expect(winners[0], label).toEqual(ops)
    }
  })

  it('keeps every intermediate value a non negative integer', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const difficulty = (i % 6) + 1
      const trial = generateRechenzeichen(difficulty, createRng(i * 104729 + 7))
      const operands = readOperands(trial)
      const ops = readOps(trial)
      const label = `${operands.join(' _ ')} with ${ops.join('')}`
      for (const [numerator, denominator] of traceOf(operands, ops)) {
        expect(denominator, label).toBe(1)
        expect(numerator, label).toBeGreaterThanOrEqual(0)
      }
      expect(trial.params.target, label).toBeGreaterThanOrEqual(0)
    }
  })

  it('reaches every item type at the lowest difficulty', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 600; i++) {
      seen.add(generateRechenzeichen(1, createRng(i * 7919 + 5)).itemType)
    }
    expect([...seen].sort()).toEqual([...ITEM_TYPES].sort())
  })

  it('reaches every item type at every difficulty', () => {
    for (let difficulty = 1; difficulty <= 6; difficulty++) {
      const seen = new Set<string>()
      for (let i = 0; i < 600; i++) {
        seen.add(generateRechenzeichen(difficulty, createRng(i * 31337 + difficulty)).itemType)
      }
      expect([...seen].sort(), `Stufe ${difficulty}`).toEqual([...ITEM_TYPES].sort())
    }
  })

  it('always mixes a point operation with a line operation', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const ops = readOps(generateRechenzeichen((i % 6) + 1, createRng(i * 15485863 + 29)))
      expect(ops.some((op) => op === '*' || op === ':'), ops.join('')).toBe(true)
      expect(ops.some((op) => op === '+' || op === '-'), ops.join('')).toBe(true)
    }
  })

  it('holds division back on the two lowest difficulties and uses it above', () => {
    for (let difficulty = 1; difficulty <= 2; difficulty++) {
      for (let i = 0; i < 500; i++) {
        const ops = readOps(generateRechenzeichen(difficulty, createRng(i * 65537 + difficulty)))
        expect(ops, `Stufe ${difficulty}`).not.toContain(':')
      }
    }
    for (let difficulty = 3; difficulty <= 6; difficulty++) {
      let withDivision = 0
      for (let i = 0; i < 500; i++) {
        const ops = readOps(generateRechenzeichen(difficulty, createRng(i * 65537 + difficulty)))
        if (ops.includes(':')) withDivision++
      }
      expect(withDivision, `Stufe ${difficulty}`).toBeGreaterThan(100)
    }
  })

  it('grows the numbers as difficulty rises', () => {
    const scale = (difficulty: number) => {
      let total = 0
      for (let i = 0; i < 500; i++) {
        const operands = readOperands(generateRechenzeichen(difficulty, createRng(i * 97 + difficulty)))
        total += Math.max(...operands)
      }
      return total / 500
    }
    expect(scale(6)).toBeGreaterThan(scale(3))
    expect(scale(3)).toBeGreaterThan(scale(1))
  })

  it('ships fallback items that are unique and integral', () => {
    for (const itemType of ITEM_TYPES) {
      const fallback = FALLBACKS[itemType]
      expect(fallback.ops.length, itemType).toBe(BLANKS_BY_TYPE[itemType])
      expect(fallback.operands.length, itemType).toBe(fallback.ops.length + 1)
      expect(winnersFor(fallback.operands, fallback.ops.length, fallback.target), itemType).toEqual([
        fallback.ops,
      ])
      for (const [numerator, denominator] of traceOf(fallback.operands, fallback.ops)) {
        expect(denominator, itemType).toBe(1)
        expect(numerator, itemType).toBeGreaterThanOrEqual(0)
      }
    }
  })
})

describe('rechenzeichen scoring', () => {
  const result = (correct: boolean, difficulty: number, ops: string[], response: string[]) => ({
    idx: 0,
    itemType: 'zwei-zeichen',
    difficulty,
    params: { type: 'zwei-zeichen', operands: [6, 3, 2], ops, target: 12, divisionAllowed: false },
    response,
    correct,
    rtMs: 4000,
    presentedAt: 0,
  })

  it('accepts only the exact operator sequence', () => {
    const trial = generateRechenzeichen(1, createRng(4242))
    const answer = (trial.answer as Operator[]).map((op) => String(op))
    const swapped = answer.map((op, i) => (i === 0 ? (op === '+' ? '-' : '+') : op))

    expect(definition.isCorrect!(trial, answer)).toBe(true)
    expect(definition.isCorrect!(trial, swapped)).toBe(false)
    expect(definition.isCorrect!(trial, answer.slice(0, -1))).toBe(false)
    expect(definition.isCorrect!(trial, [...answer, '+'])).toBe(false)
    expect(definition.isCorrect!(trial, 'plus')).toBe(false)
    expect(definition.isCorrect!(trial, null)).toBe(false)
  })

  it('rewards the same accuracy at higher difficulty', () => {
    const rows = (difficulty: number) => [
      result(true, difficulty, ['+', '*'], ['+', '*']),
      result(true, difficulty, ['+', '*'], ['+', '*']),
      result(true, difficulty, ['+', '*'], ['+', '*']),
      result(false, difficulty, ['+', '*'], ['+', '+']),
    ]
    const easy = definition.score(rows(1), 60)
    const hard = definition.score(rows(6), 60)
    expect(easy.accuracy).toBe(hard.accuracy)
    expect(hard.raw).toBeGreaterThan(easy.raw)
  })

  it('counts single operators as a partial credit metric', () => {
    const score = definition.score(
      [
        result(true, 1, ['+', '*'], ['+', '*']),
        result(false, 1, ['+', '*'], ['+', '+']),
        result(false, 1, ['+', '*'], ['-', '-']),
      ],
      60,
    )
    expect(score.metrics.zeichen).toBe(6)
    expect(score.metrics.zeichentreffer).toBe(3)
    expect(score.metrics.attempted).toBe(3)
    expect(score.metrics.correct).toBe(1)
  })

  it('reports zero for an empty session without throwing', () => {
    const score = definition.score([], 60)
    expect(score.raw).toBe(0)
    expect(score.accuracy).toBe(0)
    expect(score.metrics.medianRtMs).toBe(0)
  })
})
