import type { Rng } from '~~/shared/rng'
import type { JsonObject, Trial } from '~~/shared/types'

export interface UmrechnenPayload {
  label: string
  prompt: string
  suffix: string
}

export type UmrechnenTrial = Trial<UmrechnenPayload, number>

export const ITEM_TYPES = [
  'laenge',
  'flaeche',
  'volumen',
  'zeit',
  'geschwindigkeit',
  'massstab',
  'bruch-prozent',
] as const

export type ItemType = (typeof ITEM_TYPES)[number]

export const ITEM_LABELS: Record<ItemType, string> = {
  laenge: 'Länge',
  flaeche: 'Fläche',
  volumen: 'Volumen',
  zeit: 'Zeit',
  geschwindigkeit: 'Tempo',
  massstab: 'Massstab',
  'bruch-prozent': 'Bruch und Prozent',
}

const LINEAR_EXPONENTS = { mm: -3, cm: -2, dm: -1, m: 0, km: 3 } as const

type LinearUnit = keyof typeof LINEAR_EXPONENTS

const LINEAR_ORDER: readonly LinearUnit[] = ['mm', 'cm', 'dm', 'm', 'km']
const CUBIC_ORDER: readonly LinearUnit[] = ['mm', 'cm', 'dm', 'm']

export interface UnitSpec {
  key: string
  label: string
  exponent: number
  awkward: boolean
}

const LAENGE_UNITS: readonly UnitSpec[] = LINEAR_ORDER.map((key) => ({
  key,
  label: key,
  exponent: LINEAR_EXPONENTS[key],
  awkward: false,
}))

const SQUARE_METRE_EXPONENT = 2 * LINEAR_EXPONENTS.m

const FLAECHE_UNITS: readonly UnitSpec[] = [
  ...LINEAR_ORDER.map((key) => ({
    key: `${key}2`,
    label: `${key}²`,
    exponent: 2 * LINEAR_EXPONENTS[key],
    awkward: false,
  })),
  { key: 'a', label: 'a', exponent: SQUARE_METRE_EXPONENT + 2, awkward: true },
  { key: 'ha', label: 'ha', exponent: SQUARE_METRE_EXPONENT + 4, awkward: true },
]

const LITER_EXPONENT = 3 * LINEAR_EXPONENTS.dm

const VOLUMEN_UNITS: readonly UnitSpec[] = [
  ...CUBIC_ORDER.map((key) => ({
    key: `${key}3`,
    label: `${key}³`,
    exponent: 3 * LINEAR_EXPONENTS[key],
    awkward: true,
  })),
  { key: 'ml', label: 'ml', exponent: LITER_EXPONENT - 3, awkward: false },
  { key: 'cl', label: 'cl', exponent: LITER_EXPONENT - 2, awkward: false },
  { key: 'dl', label: 'dl', exponent: LITER_EXPONENT - 1, awkward: false },
  { key: 'l', label: 'l', exponent: LITER_EXPONENT, awkward: false },
  { key: 'hl', label: 'hl', exponent: LITER_EXPONENT + 2, awkward: false },
]

export type MetricDimension = 'laenge' | 'flaeche' | 'volumen'

export const METRIC_UNITS: Record<MetricDimension, readonly UnitSpec[]> = {
  laenge: LAENGE_UNITS,
  flaeche: FLAECHE_UNITS,
  volumen: VOLUMEN_UNITS,
}

const UNIT_BY_KEY = new Map<string, UnitSpec>(
  [...LAENGE_UNITS, ...FLAECHE_UNITS, ...VOLUMEN_UNITS].map((unit) => [unit.key, unit]),
)

export function unitByKey(key: string): UnitSpec {
  const unit = UNIT_BY_KEY.get(key)
  if (!unit) throw new RangeError(`unbekannte Einheit ${key}`)
  return unit
}

export function factorBetween(from: string, to: string): number {
  return 10 ** (unitByKey(from).exponent - unitByKey(to).exponent)
}

const SECOND = 1
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export interface TimeUnitSpec {
  key: string
  label: string
  seconds: number
}

export const TIME_UNITS: readonly TimeUnitSpec[] = [
  { key: 's', label: 's', seconds: SECOND },
  { key: 'min', label: 'min', seconds: MINUTE },
  { key: 'h', label: 'h', seconds: HOUR },
  { key: 'd', label: 'd', seconds: DAY },
]

export function secondsFor(key: string): number {
  const unit = TIME_UNITS.find((entry) => entry.key === key)
  if (!unit) throw new RangeError(`unbekannte Zeiteinheit ${key}`)
  return unit.seconds
}

const SECONDS_PER_HOUR = HOUR / SECOND
const METRES_PER_KM = 10 ** (LINEAR_EXPONENTS.km - LINEAR_EXPONENTS.m)
const CM_PER_M = 10 ** (LINEAR_EXPONENTS.m - LINEAR_EXPONENTS.cm)

export function kmhFromMps(mps: number): number {
  return (mps * SECONDS_PER_HOUR) / METRES_PER_KM
}

export function realMetresFor(scale: number, mapCm: number): number {
  return (mapCm * scale) / CM_PER_M
}

export function percentFor(numerator: number, denominator: number): number {
  return (numerator * 100) / denominator
}

const PRODUCT_MAX = 1_000_000
const MIN_STEPS: readonly number[] = [1, 1, 1, 2, 2, 3]
const MAX_STEPS: readonly number[] = [3, 3, 4, 5, 6, 6]
const VALUE_MAX: readonly number[] = [40, 60, 120, 250, 500, 900]
const TIME_SPAN: readonly number[] = [1, 1, 2, 2, 3, 3]
const MIXED_MAJOR_MAX: readonly number[] = [3, 4, 5, 6, 8, 10]
const SPEED_MAX: readonly number[] = [4, 5, 6, 7, 8, 10]
const MAP_MAX: readonly number[] = [8, 8, 10, 12, 14, 16]

const SIMPLE_SCALES: readonly number[] = [100, 200, 500, 1000]
const AWKWARD_SCALES: readonly number[] = [2000, 2500, 5000, 10000, 25000, 50000]
const EASY_DENOMINATORS: readonly number[] = [2, 4, 5, 10]
const HARD_DENOMINATORS: readonly number[] = [20, 25, 50]

const MIXED_TIME_PAIRS: readonly (readonly [number, number])[] = [
  [1, 0],
  [2, 1],
  [3, 2],
]

export function tier(difficulty: number): number {
  const rounded = Math.round(difficulty)
  return Math.min(6, Math.max(1, rounded)) - 1
}

function allowsAwkward(difficulty: number): boolean {
  return tier(difficulty) >= 2
}

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

function make(
  itemType: ItemType,
  difficulty: number,
  prompt: string,
  suffix: string,
  answer: number,
  params: JsonObject,
): UmrechnenTrial {
  return {
    itemType,
    difficulty,
    params: { type: itemType, ...params },
    payload: { label: ITEM_LABELS[itemType], prompt, suffix },
    answer,
  }
}

interface Sides {
  given: number
  answer: number
}

function sidesFor(ratio: number, shrinking: boolean, cap: number, rng: Rng): Sides {
  const limit = Math.max(1, Math.min(cap, Math.floor(PRODUCT_MAX / ratio)))
  const few = rng.int(1, limit)
  const many = few * ratio
  return shrinking ? { given: few, answer: many } : { given: many, answer: few }
}

interface UnitPair {
  from: UnitSpec
  to: UnitSpec
  steps: number
}

export function pairsFor(dimension: MetricDimension, difficulty: number): UnitPair[] {
  const units = allowsAwkward(difficulty)
    ? METRIC_UNITS[dimension]
    : METRIC_UNITS[dimension].filter((unit) => !unit.awkward)
  const minSteps = MIN_STEPS[tier(difficulty)]!
  const maxSteps = MAX_STEPS[tier(difficulty)]!
  const pairs: UnitPair[] = []
  for (const from of units) {
    for (const to of units) {
      const steps = Math.abs(from.exponent - to.exponent)
      if (steps < minSteps || steps > maxSteps) continue
      pairs.push({ from, to, steps })
    }
  }
  return pairs
}

function metric(dimension: MetricDimension, difficulty: number, rng: Rng): UmrechnenTrial {
  const pair = rng.pick(pairsFor(dimension, difficulty))
  const ratio = 10 ** pair.steps
  const shrinking = pair.from.exponent > pair.to.exponent
  const sides = sidesFor(ratio, shrinking, VALUE_MAX[tier(difficulty)]!, rng)
  return make(
    dimension,
    difficulty,
    `${sides.given} ${pair.from.label} in ${pair.to.label}`,
    pair.to.label,
    sides.answer,
    {
      variant: 'metrisch',
      from: pair.from.key,
      to: pair.to.key,
      given: sides.given,
      answer: sides.answer,
      steps: pair.steps,
    },
  )
}

function zeitEinfach(difficulty: number, rng: Rng): UmrechnenTrial {
  const span = TIME_SPAN[tier(difficulty)]!
  const pairs: (readonly [TimeUnitSpec, TimeUnitSpec])[] = []
  for (let i = 0; i < TIME_UNITS.length; i++) {
    for (let j = 0; j < TIME_UNITS.length; j++) {
      const distance = Math.abs(i - j)
      if (distance === 0 || distance > span) continue
      pairs.push([TIME_UNITS[i]!, TIME_UNITS[j]!])
    }
  }
  const [from, to] = rng.pick(pairs)
  const ratio = Math.max(from.seconds, to.seconds) / Math.min(from.seconds, to.seconds)
  const sides = sidesFor(ratio, from.seconds > to.seconds, VALUE_MAX[tier(difficulty)]!, rng)
  return make(
    'zeit',
    difficulty,
    `${sides.given} ${from.label} in ${to.label}`,
    to.label,
    sides.answer,
    {
      variant: 'einfach',
      from: from.key,
      to: to.key,
      given: sides.given,
      answer: sides.answer,
    },
  )
}

function zeitGemischt(difficulty: number, rng: Rng): UmrechnenTrial {
  const [bigIndex, smallIndex] = rng.pick(MIXED_TIME_PAIRS)
  const big = TIME_UNITS[bigIndex]!
  const small = TIME_UNITS[smallIndex]!
  const ratio = big.seconds / small.seconds
  const major = rng.int(1, MIXED_MAJOR_MAX[tier(difficulty)]!)
  const minor =
    tier(difficulty) <= 1 ? 5 * rng.int(1, Math.floor((ratio - 1) / 5)) : rng.int(1, ratio - 1)
  const answer = major * ratio + minor
  return make(
    'zeit',
    difficulty,
    `${major} ${big.label} ${minor} ${small.label} in ${small.label}`,
    small.label,
    answer,
    {
      variant: 'gemischt',
      from: big.key,
      to: small.key,
      major,
      minor,
      answer,
    },
  )
}

function geschwindigkeit(difficulty: number, rng: Rng): UmrechnenTrial {
  const mps = 5 * rng.int(1, SPEED_MAX[tier(difficulty)]!)
  const kmh = kmhFromMps(mps)
  const toKmh = rng.bool()
  const given = toKmh ? mps : kmh
  const answer = toKmh ? kmh : mps
  const fromLabel = toKmh ? 'm/s' : 'km/h'
  const toLabel = toKmh ? 'km/h' : 'm/s'
  return make(
    'geschwindigkeit',
    difficulty,
    `${given} ${fromLabel} in ${toLabel}`,
    toLabel,
    answer,
    {
      variant: toKmh ? 'mps-zu-kmh' : 'kmh-zu-mps',
      mps,
      kmh,
      given,
      answer,
    },
  )
}

function massstab(difficulty: number, rng: Rng): UmrechnenTrial {
  const scales = allowsAwkward(difficulty) ? [...SIMPLE_SCALES, ...AWKWARD_SCALES] : SIMPLE_SCALES
  const scale = rng.pick(scales)
  const mapCm = rng.int(1, MAP_MAX[tier(difficulty)]!)
  const realM = realMetresFor(scale, mapCm)
  const toReal = rng.bool()
  const prompt = toReal
    ? `Massstab 1:${scale}, auf der Karte ${mapCm} cm. Wie viel ist das in Wirklichkeit?`
    : `Massstab 1:${scale}, in Wirklichkeit ${realM} m. Wie viel ist das auf der Karte?`
  return make('massstab', difficulty, prompt, toReal ? 'm' : 'cm', toReal ? realM : mapCm, {
    variant: toReal ? 'karte-zu-real' : 'real-zu-karte',
    scale,
    mapCm,
    realM,
    given: toReal ? mapCm : realM,
    answer: toReal ? realM : mapCm,
  })
}

function bruchProzent(difficulty: number, rng: Rng): UmrechnenTrial {
  const denominators = allowsAwkward(difficulty)
    ? [...EASY_DENOMINATORS, ...HARD_DENOMINATORS]
    : EASY_DENOMINATORS
  const pool: (readonly [number, number])[] = []
  for (const denominator of denominators) {
    for (let numerator = 1; numerator < denominator; numerator++) {
      if (gcd(numerator, denominator) === 1) pool.push([numerator, denominator])
    }
  }
  const [numerator, denominator] = rng.pick(pool)
  const percent = percentFor(numerator, denominator)
  const toPercent = rng.bool()
  const prompt = toPercent
    ? `${numerator}/${denominator} in Prozent`
    : `${percent} % als Bruch mit Nenner ${denominator}`
  return make(
    'bruch-prozent',
    difficulty,
    prompt,
    toPercent ? '%' : `/ ${denominator}`,
    toPercent ? percent : numerator,
    {
      variant: toPercent ? 'bruch-zu-prozent' : 'prozent-zu-bruch',
      numerator,
      denominator,
      percent,
      given: toPercent ? numerator : percent,
      answer: toPercent ? percent : numerator,
    },
  )
}

const WEIGHTS: readonly (readonly [ItemType, number])[] = [
  ['laenge', 3],
  ['flaeche', 3],
  ['volumen', 3],
  ['zeit', 3],
  ['geschwindigkeit', 2],
  ['massstab', 2],
  ['bruch-prozent', 2],
]

export function generateUmrechnung(difficulty: number, rng: Rng): UmrechnenTrial {
  const itemType = rng.weighted(WEIGHTS)

  switch (itemType) {
    case 'laenge':
      return metric('laenge', difficulty, rng)
    case 'flaeche':
      return metric('flaeche', difficulty, rng)
    case 'volumen':
      return metric('volumen', difficulty, rng)
    case 'zeit':
      return rng.bool(0.55) ? zeitEinfach(difficulty, rng) : zeitGemischt(difficulty, rng)
    case 'geschwindigkeit':
      return geschwindigkeit(difficulty, rng)
    case 'massstab':
      return massstab(difficulty, rng)
    case 'bruch-prozent':
      return bruchProzent(difficulty, rng)
  }
}
