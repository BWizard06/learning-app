import type { Rng } from '~~/shared/rng'
import type { Trial } from '~~/shared/types'

export const OPERATORS = ['+', '-', '*', ':'] as const
export type Operator = (typeof OPERATORS)[number]

export const OPERATOR_LABELS: Record<Operator, string> = {
  '+': '+',
  '-': '-',
  '*': '×',
  ':': ':',
}

export const OPERATOR_NAMES: Record<Operator, string> = {
  '+': 'plus',
  '-': 'minus',
  '*': 'mal',
  ':': 'geteilt durch',
}

export const ITEM_TYPES = ['zwei-zeichen', 'drei-zeichen', 'vier-zeichen'] as const
export type ItemType = (typeof ITEM_TYPES)[number]

export const BLANKS_BY_TYPE: Record<ItemType, number> = {
  'zwei-zeichen': 2,
  'drei-zeichen': 3,
  'vier-zeichen': 4,
}

export interface RechenzeichenPayload {
  operands: number[]
  target: number
  blanks: number
}

export type RechenzeichenTrial = Trial<RechenzeichenPayload, Operator[]>

export interface Evaluation {
  value: number
  steps: number[]
}

export interface Fraction {
  n: number
  d: number
}

export interface Solution {
  ops: Operator[]
  target: number
  steps: number[]
}

const MAX_ATTEMPTS = 100
const DIVISION_PREFERENCE = 0.5
const DIVISION_PATIENCE = 24

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y !== 0) {
    const t = y
    y = x % y
    x = t
  }
  return x
}

export function evaluateIntegral(
  operands: readonly number[],
  ops: readonly Operator[],
): Evaluation | null {
  if (operands.length !== ops.length + 1) return null
  const steps: number[] = []
  let total = 0
  let sign = 1
  let term = operands[0]!
  if (!Number.isInteger(term) || term < 0) return null

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]!
    const next = operands[i + 1]!
    if (!Number.isInteger(next) || next < 0) return null

    if (op === '*') {
      term = term * next
      steps.push(term)
      continue
    }
    if (op === ':') {
      if (next === 0 || term % next !== 0) return null
      term = term / next
      steps.push(term)
      continue
    }
    total = total + sign * term
    if (total < 0) return null
    steps.push(total)
    sign = op === '+' ? 1 : -1
    term = next
  }

  total = total + sign * term
  if (total < 0) return null
  steps.push(total)
  return { value: total, steps }
}

export function evaluateExact(operands: readonly number[], ops: readonly Operator[]): Fraction {
  let totalN = 0
  let totalD = 1
  let sign = 1
  let termN = operands[0]!
  let termD = 1

  const fold = () => {
    const n = totalN * termD + sign * termN * totalD
    const d = totalD * termD
    const divisor = gcd(n, d) || 1
    totalN = n / divisor
    totalD = d / divisor
  }

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]!
    const next = operands[i + 1]!
    if (op === '*') {
      termN = termN * next
      continue
    }
    if (op === ':') {
      termD = termD * next
      continue
    }
    fold()
    sign = op === '+' ? 1 : -1
    termN = next
    termD = 1
  }

  fold()
  return { n: totalN, d: totalD }
}

function operatorTuples(blanks: number): Operator[][] {
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

const TUPLES: Record<number, Operator[][]> = {
  2: operatorTuples(2),
  3: operatorTuples(3),
  4: operatorTuples(4),
}

export function uniqueSolutions(operands: readonly number[]): Solution[] {
  const tuples = TUPLES[operands.length - 1]
  if (!tuples) return []

  const counts = new Map<string, number>()
  const values: Fraction[] = []
  for (const ops of tuples) {
    const value = evaluateExact(operands, ops)
    values.push(value)
    const key = `${value.n}/${value.d}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const solutions: Solution[] = []
  for (let i = 0; i < tuples.length; i++) {
    const value = values[i]!
    if (counts.get(`${value.n}/${value.d}`) !== 1) continue
    if (value.d !== 1) continue
    const evaluation = evaluateIntegral(operands, tuples[i]!)
    if (!evaluation || evaluation.value !== value.n) continue
    solutions.push({ ops: tuples[i]!, target: evaluation.value, steps: evaluation.steps })
  }
  return solutions
}

interface TierConfig {
  operandMin: number
  operandMax: number
  division: boolean
  maxValue: number
  typeWeights: readonly (readonly [ItemType, number])[]
}

const TIERS: readonly TierConfig[] = [
  {
    operandMin: 2,
    operandMax: 9,
    division: false,
    maxValue: 120,
    typeWeights: [
      ['zwei-zeichen', 6],
      ['drei-zeichen', 3],
      ['vier-zeichen', 1],
    ],
  },
  {
    operandMin: 2,
    operandMax: 12,
    division: true,
    maxValue: 300,
    typeWeights: [
      ['zwei-zeichen', 4],
      ['drei-zeichen', 4],
      ['vier-zeichen', 2],
    ],
  },
  {
    operandMin: 2,
    operandMax: 20,
    division: true,
    maxValue: 700,
    typeWeights: [
      ['zwei-zeichen', 2],
      ['drei-zeichen', 4],
      ['vier-zeichen', 4],
    ],
  },
]

export function tierOf(difficulty: number): number {
  if (difficulty <= 2) return 0
  if (difficulty <= 4) return 1
  return 2
}

export const FALLBACKS: Record<ItemType, { operands: number[]; ops: Operator[]; target: number }> = {
  'zwei-zeichen': { operands: [6, 3, 2], ops: ['+', '*'], target: 12 },
  'drei-zeichen': { operands: [8, 4, 2, 3], ops: ['+', '-', '*'], target: 6 },
  'vier-zeichen': { operands: [8, 4, 2, 3, 6], ops: ['+', '*', '*', '-'], target: 26 },
}

function make(
  itemType: ItemType,
  difficulty: number,
  operands: readonly number[],
  ops: readonly Operator[],
  target: number,
  divisionAllowed: boolean,
): RechenzeichenTrial {
  return {
    itemType,
    difficulty,
    params: {
      type: itemType,
      operands: operands.slice(),
      ops: ops.slice(),
      target,
      divisionAllowed,
    },
    payload: {
      operands: operands.slice(),
      target,
      blanks: ops.length,
    },
    answer: ops.slice(),
  }
}

export function generateRechenzeichen(difficulty: number, rng: Rng): RechenzeichenTrial {
  const tier = TIERS[tierOf(difficulty)]!
  const itemType = rng.weighted(tier.typeWeights)
  const blanks = BLANKS_BY_TYPE[itemType]
  const wantDivision = tier.division && rng.bool(DIVISION_PREFERENCE)

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const operands: number[] = []
    for (let i = 0; i <= blanks; i++) operands.push(rng.int(tier.operandMin, tier.operandMax))

    const usable = uniqueSolutions(operands).filter((solution) => {
      if (!tier.division && solution.ops.includes(':')) return false
      if (!solution.ops.some((op) => op === '*' || op === ':')) return false
      if (!solution.ops.some((op) => op === '+' || op === '-')) return false
      return solution.steps.every((step) => step <= tier.maxValue)
    })
    if (usable.length === 0) continue

    let pool = usable
    if (wantDivision) {
      const divided = usable.filter((solution) => solution.ops.includes(':'))
      if (divided.length === 0 && attempt < DIVISION_PATIENCE) continue
      if (divided.length > 0) pool = divided
    }

    const chosen = rng.pick(pool)
    return make(itemType, difficulty, operands, chosen.ops, chosen.target, tier.division)
  }

  const fallback = FALLBACKS[itemType]
  return make(
    itemType,
    difficulty,
    fallback.operands,
    fallback.ops,
    fallback.target,
    tier.division,
  )
}
