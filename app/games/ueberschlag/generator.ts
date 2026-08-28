import type { Rng } from '~~/shared/rng'
import type { ChoiceOption, JsonObject, Trial } from '~~/shared/types'

export const ITEM_TYPES = ['multiplikation', 'division', 'prozent', 'summe', 'gemischt'] as const

export type ItemType = (typeof ITEM_TYPES)[number]

export const MIXED_FORMS = ['produkt-plus', 'produkt-minus', 'summe-mal'] as const

export type MixedForm = (typeof MIXED_FORMS)[number]

export const MISTAKE_KINDS = [
  'faktor-zehn-hoch',
  'faktor-zehn-tief',
  'kommastelle-hoch',
  'kommastelle-tief',
  'umkehroperation',
  'knapp-daneben',
] as const

export type MistakeKind = (typeof MISTAKE_KINDS)[number]

export type OptionKind = MistakeKind | 'richtig'

export const OPTION_COUNT = 5
export const DISTRACTOR_COUNT = 4
export const GROUP_MARK = '’'
export const QUESTION = 'Welches Ergebnis stimmt?'
export const MIN_VALUE = 100
export const MIN_VALUE_FOR_KOMMA_TIEF = 2000

export interface EstimatePayload {
  question: string
  expression: string
}

export type EstimateTrial = Trial<EstimatePayload, number>

const LEVEL_COUNT = 6

function level(difficulty: number): number {
  const rounded = Math.round(difficulty)
  return Math.min(LEVEL_COUNT, Math.max(1, rounded)) - 1
}

export function groupDigits(value: number): string {
  const digits = String(value)
  let out = ''
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += GROUP_MARK
    out += digits[i]
  }
  return out
}

interface Spec {
  itemType: ItemType
  params: JsonObject
  expression: string
  value: number
  inverse: number | null
}

interface Candidate {
  kind: OptionKind
  value: number
}

const BANDS: readonly { kind: MistakeKind; ranges: readonly (readonly [number, number])[] }[] = [
  { kind: 'kommastelle-hoch', ranges: [[90, 110]] },
  { kind: 'faktor-zehn-hoch', ranges: [[9, 11]] },
  { kind: 'knapp-daneben', ranges: [[0.84, 0.985], [1.015, 1.16]] },
  { kind: 'faktor-zehn-tief', ranges: [[0.09, 0.11]] },
  { kind: 'kommastelle-tief', ranges: [[0.009, 0.011]] },
]

function bandOf(ratio: number): MistakeKind | null {
  for (const band of BANDS) {
    for (const range of band.ranges) {
      if (ratio >= range[0] && ratio <= range[1]) return band.kind
    }
  }
  return null
}

const BIG_FACTOR: readonly (readonly [number, number])[] = [
  [110, 490],
  [150, 890],
  [210, 1900],
  [320, 4800],
  [1100, 9900],
  [2100, 49000],
]

const SMALL_FACTOR: readonly (readonly [number, number])[] = [
  [11, 19],
  [11, 29],
  [12, 49],
  [13, 79],
  [14, 99],
  [21, 99],
]

const PERCENTS: readonly (readonly number[])[] = [
  [5, 20, 25, 50],
  [15, 20, 25, 40, 50, 75],
  [12, 15, 18, 25, 35, 45, 60],
  [8, 12, 18, 22, 35, 45, 65, 80],
  [4, 6, 8, 14, 22, 28, 44, 62, 85],
  [4, 6, 7, 9, 13, 17, 23, 29, 37, 43, 58, 67, 83, 90],
]

const BASE_HUNDREDS: readonly (readonly [number, number])[] = [
  [25, 95],
  [30, 290],
  [45, 780],
  [70, 2400],
  [120, 7800],
  [250, 24000],
]

const TERM_COUNTS: readonly number[] = [3, 3, 4, 4, 5, 5]

const TERMS: readonly (readonly [number, number])[] = [
  [110, 990],
  [210, 3900],
  [420, 9800],
  [1100, 29000],
  [2100, 79000],
  [4100, 290000],
]

const MIXED_FACTOR: readonly (readonly [number, number])[] = [
  [110, 490],
  [150, 890],
  [210, 1900],
  [320, 4800],
  [1100, 9900],
  [2100, 29000],
]

const MIXED_MULTIPLIER: readonly (readonly [number, number])[] = [
  [4, 7],
  [4, 9],
  [6, 9],
  [11, 19],
  [12, 29],
  [13, 49],
]

const NEAR_MISS: readonly (readonly [number, number])[] = [
  [0.11, 0.15],
  [0.1, 0.14],
  [0.085, 0.12],
  [0.07, 0.1],
  [0.055, 0.085],
  [0.04, 0.07],
]

function offTen(rng: Rng, range: readonly [number, number]): number {
  const value = rng.int(range[0], range[1])
  return value % 10 === 0 ? value + 1 : value
}

function multiplikation(rng: Rng, difficulty: number): Spec {
  const lv = level(difficulty)
  const a = rng.int(BIG_FACTOR[lv]![0], BIG_FACTOR[lv]![1])
  const b = offTen(rng, SMALL_FACTOR[lv]!)
  const inverse = Math.round(a / b)
  return {
    itemType: 'multiplikation',
    params: { type: 'multiplikation', a, b },
    expression: `${groupDigits(a)} × ${groupDigits(b)}`,
    value: a * b,
    inverse: inverse >= 2 ? inverse : null,
  }
}

function division(rng: Rng, difficulty: number): Spec {
  const lv = level(difficulty)
  const quotient = rng.int(BIG_FACTOR[lv]![0], BIG_FACTOR[lv]![1])
  const divisor = offTen(rng, SMALL_FACTOR[lv]!)
  const dividend = divisor * quotient
  return {
    itemType: 'division',
    params: { type: 'division', dividend, divisor, quotient },
    expression: `${groupDigits(dividend)} : ${groupDigits(divisor)}`,
    value: quotient,
    inverse: dividend * divisor,
  }
}

function prozent(rng: Rng, difficulty: number): Spec {
  const lv = level(difficulty)
  const percent = rng.pick(PERCENTS[lv]!)
  const base = 100 * rng.int(BASE_HUNDREDS[lv]![0], BASE_HUNDREDS[lv]![1])
  return {
    itemType: 'prozent',
    params: { type: 'prozent', percent, base },
    expression: `${percent} % von ${groupDigits(base)}`,
    value: (base / 100) * percent,
    inverse: Math.round((base * 100) / percent),
  }
}

function summe(rng: Rng, difficulty: number): Spec {
  const lv = level(difficulty)
  const range = TERMS[lv]!
  const terms: number[] = []
  for (let i = 0; i < TERM_COUNTS[lv]!; i++) terms.push(rng.int(range[0], range[1]))
  const value = terms.reduce((sum, term) => sum + term, 0)
  const largest = Math.max(...terms)
  const inverse = 2 * largest - value
  return {
    itemType: 'summe',
    params: { type: 'summe', terms: [...terms] },
    expression: terms.map((term) => groupDigits(term)).join(' + '),
    value,
    inverse: inverse > 0 ? inverse : null,
  }
}

function gemischt(rng: Rng, difficulty: number): Spec {
  const lv = level(difficulty)
  const form = rng.pick(MIXED_FORMS)

  if (form === 'summe-mal') {
    const a = rng.int(MIXED_FACTOR[lv]![0], MIXED_FACTOR[lv]![1])
    const b = rng.int(MIXED_FACTOR[lv]![0], MIXED_FACTOR[lv]![1])
    const c = offTen(rng, MIXED_MULTIPLIER[lv]!)
    const inverse = Math.round((a + b) / c)
    return {
      itemType: 'gemischt',
      params: { type: 'gemischt', form, a, b, c },
      expression: `(${groupDigits(a)} + ${groupDigits(b)}) × ${groupDigits(c)}`,
      value: (a + b) * c,
      inverse: inverse >= 2 ? inverse : null,
    }
  }

  const a = rng.int(MIXED_FACTOR[lv]![0], MIXED_FACTOR[lv]![1])
  const b = offTen(rng, SMALL_FACTOR[lv]!)
  const product = a * b
  const c = Math.max(10, Math.round((product * rng.float(0.2, 0.7)) / 10) * 10)
  const sign = form === 'produkt-plus' ? '+' : '−'
  return {
    itemType: 'gemischt',
    params: { type: 'gemischt', form, a, b, c },
    expression: `${groupDigits(a)} × ${groupDigits(b)} ${sign} ${groupDigits(c)}`,
    value: form === 'produkt-plus' ? product + c : product - c,
    inverse: form === 'produkt-plus' ? product - c : product + c,
  }
}

function specFor(itemType: ItemType, difficulty: number, rng: Rng): Spec {
  switch (itemType) {
    case 'multiplikation':
      return multiplikation(rng, difficulty)
    case 'division':
      return division(rng, difficulty)
    case 'prozent':
      return prozent(rng, difficulty)
    case 'summe':
      return summe(rng, difficulty)
    case 'gemischt':
      return gemischt(rng, difficulty)
  }
}

function fits(kind: MistakeKind, value: number, truth: number): boolean {
  if (!Number.isInteger(value) || value <= 0 || value === truth) return false
  const wanted = kind === 'umkehroperation' ? null : kind
  return bandOf(value / truth) === wanted
}

function tenCandidates(spec: Spec): Candidate[] {
  const out: Candidate[] = []
  const high = spec.value * 10
  if (fits('faktor-zehn-hoch', high, spec.value)) out.push({ kind: 'faktor-zehn-hoch', value: high })
  const low = Math.round(spec.value / 10)
  if (fits('faktor-zehn-tief', low, spec.value)) out.push({ kind: 'faktor-zehn-tief', value: low })
  return out
}

function kommaCandidates(spec: Spec): Candidate[] {
  const out: Candidate[] = []
  const shifted = Math.round(spec.value / 100)
  if (spec.value >= MIN_VALUE_FOR_KOMMA_TIEF && fits('kommastelle-tief', shifted, spec.value)) {
    out.push({ kind: 'kommastelle-tief', value: shifted })
  }
  const raised = spec.value * 100
  if (fits('kommastelle-hoch', raised, spec.value)) {
    out.push({ kind: 'kommastelle-hoch', value: raised })
  }
  return out
}

function inverseCandidate(spec: Spec): Candidate | null {
  if (spec.inverse === null || !fits('umkehroperation', spec.inverse, spec.value)) return null
  return { kind: 'umkehroperation', value: spec.inverse }
}

function dropOneEach(pool: readonly Candidate[]): Candidate[][] {
  if (pool.length <= DISTRACTOR_COUNT - 1) return [pool.slice()]
  return pool.map((_, skip) => pool.filter((__, index) => index !== skip))
}

function plansByRank(spec: Spec, difficulty: number, rng: Rng): Map<number, Candidate[][]> {
  const truth = spec.value
  const range = NEAR_MISS[level(difficulty)]!
  const gap = rng.float(range[0], range[1])
  const tens = tenCandidates(spec)
  const inverse = inverseCandidate(spec)
  const byRank = new Map<number, Candidate[][]>()

  for (const komma of kommaCandidates(spec)) {
    const pool = inverse === null ? [...tens, komma] : [...tens, komma, inverse]
    for (const subset of dropOneEach(pool)) {
      for (const direction of [-1, 1]) {
        const near: Candidate = {
          kind: 'knapp-daneben',
          value: Math.round(truth * (1 + direction * gap)),
        }
        const plan = [...subset, near]
        const rank = 1 + plan.filter((candidate) => candidate.value < truth).length
        const bucket = byRank.get(rank)
        if (bucket) bucket.push(plan)
        else byRank.set(rank, [plan])
      }
    }
  }

  return byRank
}

function buildTrial(spec: Spec, difficulty: number, rng: Rng): EstimateTrial {
  const byRank = plansByRank(spec, difficulty, rng)
  const ranks = [...byRank.keys()].sort((a, b) => a - b)
  const picked = rng.pick(byRank.get(rng.pick(ranks))!)
  const entries = rng.shuffle([{ kind: 'richtig' as OptionKind, value: spec.value }, ...picked])

  const correctIndex = entries.findIndex((entry) => entry.kind === 'richtig')

  const options: ChoiceOption[] = entries.map((entry, index) => ({
    id: `wert-${index}`,
    label: groupDigits(entry.value),
  }))

  return {
    itemType: spec.itemType,
    difficulty,
    params: {
      ...spec.params,
      value: spec.value,
      options: entries.map((entry) => ({ kind: entry.kind, value: entry.value })),
      correctIndex,
    },
    payload: { question: QUESTION, expression: spec.expression },
    answer: correctIndex,
    options,
    correctIndex,
  }
}

const TYPE_WEIGHTS: readonly (readonly [ItemType, number])[] = [
  ['multiplikation', 3],
  ['division', 3],
  ['prozent', 3],
  ['summe', 2],
  ['gemischt', 3],
]

export function generateEstimate(difficulty: number, rng: Rng): EstimateTrial {
  const itemType = rng.weighted(TYPE_WEIGHTS)
  return buildTrial(specFor(itemType, difficulty, rng), difficulty, rng)
}
