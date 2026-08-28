import type { Rng } from '~~/shared/rng'
import type { JsonObject, Trial } from '~~/shared/types'

export interface SequencePayload {
  terms: number[]
  allowNegative: boolean
}

export type SequenceTrial = Trial<SequencePayload, number>

export const ITEM_TYPES = [
  'konstante-differenz',
  'konstanter-faktor',
  'alternierende-schritte',
  'zweite-differenz',
  'differenzreihe',
  'verschachtelt',
  'fibonacci-artig',
  'quadratzahlen-versatz',
  'kubikzahlen-versatz',
  'mult-add-wechsel',
  'mult-plus-konstante',
  'primzahl-versatz',
] as const

export type ItemType = (typeof ITEM_TYPES)[number]

export const VALUE_LIMIT = 100_000

const PRIMES: readonly number[] = [
  2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97,
  101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193,
  197, 199, 211, 223, 227, 229, 233, 239, 241, 251, 257, 263, 269, 271, 277, 281,
]

export function tierOf(difficulty: number): 0 | 1 | 2 | 3 {
  if (difficulty <= 3) return 0
  if (difficulty <= 6) return 1
  if (difficulty <= 9) return 2
  return 3
}

export function negativesAllowed(difficulty: number): boolean {
  return tierOf(difficulty) >= 1
}

interface Candidate {
  itemType: ItemType
  terms: number[]
  answer: number
  params: JsonObject
}

const START_MAX = [30, 90, 260, 700] as const
const STEP_MAX = [9, 15, 28, 65] as const
const INCREMENT_MAX = [3, 4, 7, 11] as const
const UNIT_MAX = [4, 5, 8, 13] as const
const FACTOR_START_MAX = [7, 16, 40, 120] as const
const FACTOR_RESULT_MAX = [500, 5_000, 30_000, VALUE_LIMIT] as const
const SQUARE_FROM_MAX = [6, 12, 20, 30] as const
const SQUARE_OFFSET_MAX = [6, 12, 25, 40] as const
const CUBE_FROM_MAX = 10
const CUBE_OFFSET_MAX = 25
const FIB_MAX = [12, 25, 60, 160] as const
const WECHSEL_FACTOR_MAX = [2, 2, 3, 4] as const
const WECHSEL_ADDEND_MAX = [8, 12, 20, 35] as const
const WECHSEL_START_MAX = [9, 18, 40, 70] as const
const PRIME_FROM_MAX = [6, 10, 14, 22] as const
const PRIME_OFFSET_MAX = [3, 4, 6, 10] as const

const FACTOR_POOL: readonly (readonly number[])[] = [
  [2, 3],
  [2, 3, 4],
  [2, 3, 4, 5],
  [-4, -3, -2, 2, 3, 4, 5, 6],
]

const NO_ZERO_TYPES: ReadonlySet<string> = new Set([
  'konstanter-faktor',
  'mult-add-wechsel',
  'mult-plus-konstante',
])

const FAMILY_WEIGHTS: Record<ItemType, readonly [number, number, number, number]> = {
  'konstante-differenz': [5, 3, 2, 1],
  'konstanter-faktor': [4, 3, 2, 1],
  'alternierende-schritte': [4, 3, 2, 1],
  'zweite-differenz': [0, 3, 3, 2],
  'differenzreihe': [0, 2, 2, 2],
  'verschachtelt': [0, 3, 3, 3],
  'quadratzahlen-versatz': [0, 2, 2, 2],
  'fibonacci-artig': [0, 0, 3, 3],
  'mult-add-wechsel': [0, 0, 2, 3],
  'primzahl-versatz': [0, 0, 2, 3],
  'mult-plus-konstante': [0, 0, 0, 3],
  'kubikzahlen-versatz': [0, 0, 0, 2],
}

const FAMILIES_BY_TIER: readonly (readonly (readonly [ItemType, number])[])[] = [0, 1, 2, 3].map(
  (tier) =>
    ITEM_TYPES.map((type) => [type, FAMILY_WEIGHTS[type][tier]!] as const).filter(
      (entry) => entry[1] > 0,
    ),
)

function differences(values: readonly number[]): number[] {
  const out: number[] = []
  for (let i = 1; i < values.length; i++) out.push(values[i]! - values[i - 1]!)
  return out
}

function fitsConstantDifference(terms: readonly number[]): boolean {
  if (terms.length < 3) return false
  const steps = differences(terms)
  return steps.every((step) => step === steps[0]!)
}

function fitsConstantFactor(terms: readonly number[]): boolean {
  if (terms.length < 3) return false
  if (terms.some((term) => term === 0)) return false
  for (let i = 1; i + 1 < terms.length; i++) {
    if (terms[i]! * terms[i]! !== terms[i + 1]! * terms[i - 1]!) return false
  }
  return true
}

function alternatingNext(terms: readonly number[]): number | null {
  if (terms.length < 5) return null
  const steps = differences(terms)
  const even = steps[0]!
  const odd = steps[1]!
  for (let i = 0; i < steps.length; i++) {
    if (steps[i]! !== (i % 2 === 0 ? even : odd)) return null
  }
  return terms[terms.length - 1]! + (steps.length % 2 === 0 ? even : odd)
}

function secondDifferenceNext(terms: readonly number[]): number | null {
  if (terms.length < 5) return null
  const steps = differences(terms)
  const seconds = differences(steps)
  if (!seconds.every((value) => value === seconds[0]!)) return null
  return terms[terms.length - 1]! + steps[steps.length - 1]! + seconds[0]!
}

function isAmbiguous(itemType: ItemType, terms: readonly number[], answer: number): boolean {
  if (fitsConstantDifference(terms) && itemType !== 'konstante-differenz') return true
  if (fitsConstantFactor(terms) && itemType !== 'konstanter-faktor') return true
  const alternating = alternatingNext(terms)
  if (alternating !== null && alternating !== answer) return true
  const quadratic = secondDifferenceNext(terms)
  if (quadratic !== null && quadratic !== answer) return true
  return false
}

function signedInt(rng: Rng, min: number, max: number): number {
  return rng.int(min, max) * rng.sign()
}

function candidateOf(itemType: ItemType, values: number[], params: JsonObject): Candidate {
  const shown = values.length - 1
  return {
    itemType,
    terms: values.slice(0, shown),
    answer: values[shown]!,
    params: { type: itemType, shown, ...params },
  }
}

function startFor(rng: Rng, difficulty: number, relative: readonly number[]): number {
  const max = START_MAX[tierOf(difficulty)]!
  if (negativesAllowed(difficulty)) return rng.int(-max, max)
  return rng.int(1, max) - Math.min(...relative)
}

function konstanteDifferenz(rng: Rng, difficulty: number): Candidate | null {
  const shown = 5
  const step = signedInt(rng, 2, STEP_MAX[tierOf(difficulty)]!)
  const relative: number[] = []
  for (let i = 0; i <= shown; i++) relative.push(i * step)
  const start = startFor(rng, difficulty, relative)
  return candidateOf(
    'konstante-differenz',
    relative.map((value) => value + start),
    { start, step },
  )
}

function konstanterFaktor(rng: Rng, difficulty: number): Candidate | null {
  const tier = tierOf(difficulty)
  const shown = 5
  const factor = rng.pick(FACTOR_POOL[tier]!)
  const room = Math.floor(FACTOR_RESULT_MAX[tier]! / Math.abs(factor) ** shown)
  const cap = Math.max(1, Math.min(FACTOR_START_MAX[tier]!, room))
  const start = rng.int(1, cap)
  const values: number[] = []
  let value = start
  for (let i = 0; i <= shown; i++) {
    values.push(value)
    value *= factor
  }
  return candidateOf('konstanter-faktor', values, { start, factor })
}

function alternierendeSchritte(rng: Rng, difficulty: number): Candidate | null {
  const tier = tierOf(difficulty)
  const shown = 6
  const first = rng.int(2, STEP_MAX[tier]!)
  const second = rng.int(1, STEP_MAX[tier]!)
  const variant = rng.int(0, 3)
  const stepA = variant === 1 || variant === 3 ? -first : first
  const stepB = variant === 1 || variant === 2 ? second : -second
  if (stepA === stepB) return null
  if (stepA + stepB === 0) return null
  if ((stepA > 0) === (stepB > 0)) {
    const larger = Math.max(Math.abs(stepA), Math.abs(stepB))
    const gap = Math.abs(Math.abs(stepA) - Math.abs(stepB))
    if (gap < Math.max(2, 0.25 * larger)) return null
  }
  const relative: number[] = [0]
  for (let i = 0; i < shown; i++) relative.push(relative[i]! + (i % 2 === 0 ? stepA : stepB))
  const start = startFor(rng, difficulty, relative)
  return candidateOf(
    'alternierende-schritte',
    relative.map((value) => value + start),
    { start, stepA, stepB },
  )
}

function zweiteDifferenz(rng: Rng, difficulty: number): Candidate | null {
  const tier = tierOf(difficulty)
  const shown = 6
  const firstStep = signedInt(rng, 1, STEP_MAX[tier]!)
  const increment = signedInt(rng, 1, INCREMENT_MAX[tier]!)
  const relative: number[] = [0]
  for (let i = 0; i < shown; i++) relative.push(relative[i]! + firstStep + i * increment)
  const start = startFor(rng, difficulty, relative)
  return candidateOf(
    'zweite-differenz',
    relative.map((value) => value + start),
    { start, firstStep, increment },
  )
}

function differenzreihe(rng: Rng, difficulty: number): Candidate | null {
  const shown = 6
  const unit = signedInt(rng, 1, UNIT_MAX[tierOf(difficulty)]!)
  const relative: number[] = [0]
  for (let i = 0; i < shown; i++) relative.push(relative[i]! + unit * (i + 1))
  const start = startFor(rng, difficulty, relative)
  return candidateOf(
    'differenzreihe',
    relative.map((value) => value + start),
    { start, unit },
  )
}

function verschachtelt(rng: Rng, difficulty: number): Candidate | null {
  const tier = tierOf(difficulty)
  const shown = 6
  const stepA = signedInt(rng, 2, STEP_MAX[tier]!)
  const stepB = signedInt(rng, 2, STEP_MAX[tier]!)
  if (Math.abs(stepA - stepB) < 3) return null
  const startA = rng.int(1, START_MAX[tier]!)
  const startB = rng.int(1, START_MAX[tier]!)
  if (startA === startB) return null
  const values: number[] = []
  for (let i = 0; i <= shown; i++) {
    values.push(i % 2 === 0 ? startA + (i / 2) * stepA : startB + ((i - 1) / 2) * stepB)
  }
  return candidateOf('verschachtelt', values, { startA, stepA, startB, stepB })
}

function fibonacciArtig(rng: Rng, difficulty: number): Candidate | null {
  const tier = tierOf(difficulty)
  const shown = 6
  const cap = FIB_MAX[tier]!
  const first =
    tier === 3 && rng.bool(0.3) ? -rng.int(1, Math.max(1, Math.floor(cap / 2))) : rng.int(1, cap)
  const second = rng.int(1, cap)
  const values: number[] = [first, second]
  for (let i = 2; i <= shown; i++) values.push(values[i - 1]! + values[i - 2]!)
  if (values.some((value) => value === 0)) return null
  return candidateOf('fibonacci-artig', values, { first, second })
}

function quadratzahlenVersatz(rng: Rng, difficulty: number): Candidate | null {
  const tier = tierOf(difficulty)
  const shown = 6
  const from = rng.int(1, SQUARE_FROM_MAX[tier]!)
  const offset = signedInt(rng, 1, SQUARE_OFFSET_MAX[tier]!)
  const values: number[] = []
  for (let i = 0; i <= shown; i++) values.push((from + i) ** 2 + offset)
  return candidateOf('quadratzahlen-versatz', values, { from, offset })
}

function kubikzahlenVersatz(rng: Rng, difficulty: number): Candidate | null {
  const shown = 5
  const from = rng.int(1, CUBE_FROM_MAX)
  const offset = signedInt(rng, 1, CUBE_OFFSET_MAX)
  const values: number[] = []
  for (let i = 0; i <= shown; i++) values.push((from + i) ** 3 + offset)
  return candidateOf('kubikzahlen-versatz', values, { from, offset })
}

function multAddWechsel(rng: Rng, difficulty: number): Candidate | null {
  const tier = tierOf(difficulty)
  const shown = 6
  const factor = rng.int(2, WECHSEL_FACTOR_MAX[tier]!)
  const addend = signedInt(rng, 2, WECHSEL_ADDEND_MAX[tier]!)
  const start = rng.int(2, WECHSEL_START_MAX[tier]!)
  const multiplyFirst = rng.bool() ? 1 : 0
  const values: number[] = [start]
  for (let i = 0; i < shown; i++) {
    const multiply = (i % 2 === 0) === (multiplyFirst === 1)
    values.push(multiply ? values[i]! * factor : values[i]! + addend)
  }
  if (values.some((value) => value === 0)) return null
  return candidateOf('mult-add-wechsel', values, { start, factor, addend, multiplyFirst })
}

function multPlusKonstante(rng: Rng, difficulty: number): Candidate | null {
  const shown = 5
  const factor = rng.int(2, 4)
  const addend = signedInt(rng, 1, 25)
  const start = rng.int(1, 30)
  const values: number[] = [start]
  for (let i = 0; i < shown; i++) values.push(values[i]! * factor + addend)
  if (values.some((value) => value === 0)) return null
  return candidateOf('mult-plus-konstante', values, { start, factor, addend })
}

function primzahlVersatz(rng: Rng, difficulty: number): Candidate | null {
  const tier = tierOf(difficulty)
  const shown = 6
  const fromIndex = rng.int(0, PRIME_FROM_MAX[tier]!)
  const offset = signedInt(rng, 1, PRIME_OFFSET_MAX[tier]!)
  const values: number[] = []
  for (let i = 0; i <= shown; i++) {
    const prime = PRIMES[fromIndex + i]
    if (prime === undefined) return null
    values.push(prime + offset)
  }
  return candidateOf('primzahl-versatz', values, { fromIndex, offset })
}

function buildCandidate(itemType: ItemType, rng: Rng, difficulty: number): Candidate | null {
  switch (itemType) {
    case 'konstante-differenz':
      return konstanteDifferenz(rng, difficulty)
    case 'konstanter-faktor':
      return konstanterFaktor(rng, difficulty)
    case 'alternierende-schritte':
      return alternierendeSchritte(rng, difficulty)
    case 'zweite-differenz':
      return zweiteDifferenz(rng, difficulty)
    case 'differenzreihe':
      return differenzreihe(rng, difficulty)
    case 'verschachtelt':
      return verschachtelt(rng, difficulty)
    case 'fibonacci-artig':
      return fibonacciArtig(rng, difficulty)
    case 'quadratzahlen-versatz':
      return quadratzahlenVersatz(rng, difficulty)
    case 'kubikzahlen-versatz':
      return kubikzahlenVersatz(rng, difficulty)
    case 'mult-add-wechsel':
      return multAddWechsel(rng, difficulty)
    case 'mult-plus-konstante':
      return multPlusKonstante(rng, difficulty)
    case 'primzahl-versatz':
      return primzahlVersatz(rng, difficulty)
  }
}

function acceptable(candidate: Candidate, difficulty: number): boolean {
  const values = [...candidate.terms, candidate.answer]
  const negatives = negativesAllowed(difficulty)
  for (const value of values) {
    if (!Number.isInteger(value)) return false
    if (Math.abs(value) > VALUE_LIMIT) return false
    if (!negatives && value < 0) return false
    if (value === 0 && NO_ZERO_TYPES.has(candidate.itemType)) return false
  }
  if (new Set(values).size < 3) return false
  return !isAmbiguous(candidate.itemType, candidate.terms, candidate.answer)
}

function fallback(rng: Rng, difficulty: number): Candidate {
  const shown = 5
  const start = rng.int(2, 30)
  const step = rng.int(2, 9)
  const values: number[] = []
  for (let i = 0; i <= shown; i++) values.push(start + i * step)
  return candidateOf('konstante-differenz', values, { start, step })
}

function toTrial(candidate: Candidate, difficulty: number): SequenceTrial {
  return {
    itemType: candidate.itemType,
    difficulty,
    params: candidate.params,
    payload: { terms: candidate.terms, allowNegative: negativesAllowed(difficulty) },
    answer: candidate.answer,
  }
}

export function generateSequence(difficulty: number, rng: Rng): SequenceTrial {
  const families = FAMILIES_BY_TIER[tierOf(difficulty)]!
  for (let attempt = 0; attempt < 64; attempt++) {
    const itemType = rng.weighted(families)
    const candidate = buildCandidate(itemType, rng, difficulty)
    if (candidate && acceptable(candidate, difficulty)) return toTrial(candidate, difficulty)
  }
  return toTrial(fallback(rng, difficulty), difficulty)
}
