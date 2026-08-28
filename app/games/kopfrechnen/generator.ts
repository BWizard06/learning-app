import type { Rng } from '~~/shared/rng'
import type { JsonObject, Trial } from '~~/shared/types'

export interface ArithmeticPayload {
  text: string
  suffix?: string
}

export type ArithmeticTrial = Trial<ArithmeticPayload, number>

export const ITEM_TYPES = [
  'prozentwert',
  'prozentsatz',
  'grundwert',
  'bruchteil',
  'multiplikation',
  'division',
  'dreisatz',
  'zuschlag',
  'rabatt',
  'geschwindigkeit',
  'mischung',
] as const

export type ItemType = (typeof ITEM_TYPES)[number]

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

function tier(difficulty: number): 0 | 1 | 2 | 3 {
  if (difficulty <= 2) return 0
  if (difficulty <= 5) return 1
  if (difficulty <= 8) return 2
  return 3
}

const PERCENTS: readonly (readonly number[])[] = [
  [10, 50, 100],
  [10, 20, 25, 50, 75],
  [5, 15, 20, 30, 40, 60, 80],
  [4, 8, 12, 16, 24, 35, 45, 65, 85, 95],
]

function percentFor(rng: Rng, difficulty: number): number {
  return rng.pick(PERCENTS[tier(difficulty)]!)
}

function baseFor(rng: Rng, percent: number, difficulty: number): number {
  const step = 100 / gcd(percent, 100)
  const factorMax = [4, 10, 24, 60][tier(difficulty)]!
  return step * rng.int(1, factorMax)
}

function make(
  itemType: ItemType,
  difficulty: number,
  text: string,
  answer: number,
  params: JsonObject,
  suffix?: string,
): ArithmeticTrial {
  return {
    itemType,
    difficulty,
    params: { type: itemType, ...params },
    payload: { text, suffix },
    answer,
  }
}

function prozentwert(rng: Rng, difficulty: number): ArithmeticTrial {
  const percent = percentFor(rng, difficulty)
  const base = baseFor(rng, percent, difficulty)
  const answer = (percent * base) / 100
  return make('prozentwert', difficulty, `${percent} % von ${base}`, answer, { percent, base })
}

function prozentsatz(rng: Rng, difficulty: number): ArithmeticTrial {
  const percent = percentFor(rng, difficulty)
  const base = baseFor(rng, percent, difficulty)
  const part = (percent * base) / 100
  return make(
    'prozentsatz',
    difficulty,
    `Wie viel Prozent sind ${part} von ${base}?`,
    percent,
    { percent, base, part },
    '%',
  )
}

function grundwert(rng: Rng, difficulty: number): ArithmeticTrial {
  const percent = percentFor(rng, difficulty)
  const base = baseFor(rng, percent, difficulty)
  const part = (percent * base) / 100
  return make(
    'grundwert',
    difficulty,
    `${part} sind ${percent} % von wie viel?`,
    base,
    { percent, base, part },
  )
}

const FRACTIONS: readonly (readonly [number, number])[] = [
  [1, 2],
  [1, 3],
  [2, 3],
  [1, 4],
  [3, 4],
  [1, 5],
  [2, 5],
  [3, 5],
  [4, 5],
  [1, 6],
  [5, 6],
  [1, 8],
  [3, 8],
  [5, 8],
  [7, 8],
  [1, 12],
  [7, 12],
]

function bruchteil(rng: Rng, difficulty: number): ArithmeticTrial {
  const pool = FRACTIONS.slice(0, [3, 7, 12, FRACTIONS.length][tier(difficulty)]!)
  const [numerator, denominator] = rng.pick(pool)
  const multiplierMax = [6, 12, 30, 80][tier(difficulty)]!
  const whole = denominator * rng.int(2, multiplierMax)
  const answer = (whole / denominator) * numerator
  return make(
    'bruchteil',
    difficulty,
    `${numerator}/${denominator} von ${whole}`,
    answer,
    { numerator, denominator, whole },
  )
}

function multiplikation(rng: Rng, difficulty: number): ArithmeticTrial {
  const ranges: readonly (readonly [number, number, number, number])[] = [
    [2, 9, 2, 9],
    [3, 19, 3, 9],
    [12, 49, 4, 19],
    [13, 99, 11, 29],
  ]
  const [aLo, aHi, bLo, bHi] = ranges[tier(difficulty)]!
  const a = rng.int(aLo, aHi)
  const b = rng.int(bLo, bHi)
  return make('multiplikation', difficulty, `${a} × ${b}`, a * b, { a, b })
}

function division(rng: Rng, difficulty: number): ArithmeticTrial {
  const ranges: readonly (readonly [number, number, number, number])[] = [
    [2, 9, 2, 9],
    [2, 12, 3, 15],
    [3, 25, 4, 40],
    [7, 45, 6, 90],
  ]
  const [divisorLo, divisorHi, quotientLo, quotientHi] = ranges[tier(difficulty)]!
  const divisor = rng.int(divisorLo, divisorHi)
  const quotient = rng.int(quotientLo, quotientHi)
  return make('division', difficulty, `${divisor * quotient} : ${divisor}`, quotient, {
    divisor,
    quotient,
  })
}

function dreisatz(rng: Rng, difficulty: number): ArithmeticTrial {
  const unitMax = [6, 15, 40, 120][tier(difficulty)]!
  const unitPrice = rng.int(2, unitMax)
  const count = rng.int(2, [5, 9, 15, 24][tier(difficulty)]!)
  const wanted = rng.int(2, [8, 14, 25, 40][tier(difficulty)]!)
  const total = unitPrice * count
  return make(
    'dreisatz',
    difficulty,
    `${count} Stück kosten ${total} Fr. Was kosten ${wanted} Stück?`,
    unitPrice * wanted,
    { unitPrice, count, wanted, total },
    'Fr.',
  )
}

function zuschlagOderRabatt(rng: Rng, difficulty: number, mode: 'zuschlag' | 'rabatt'): ArithmeticTrial {
  const percent = percentFor(rng, difficulty)
  const base = baseFor(rng, percent, difficulty)
  const delta = (percent * base) / 100
  const answer = mode === 'zuschlag' ? base + delta : base - delta
  const text =
    mode === 'zuschlag'
      ? `${base} Fr. werden um ${percent} % erhöht. Wie viel ergibt das?`
      : `${base} Fr. werden um ${percent} % reduziert. Wie viel ergibt das?`
  return make(mode, difficulty, text, answer, { percent, base, delta }, 'Fr.')
}

function geschwindigkeit(rng: Rng, difficulty: number): ArithmeticTrial {
  const speed = rng.int(2, [12, 30, 90, 140][tier(difficulty)]!) * (tier(difficulty) >= 2 ? 5 : 1)
  const hours = rng.int(2, [4, 6, 9, 12][tier(difficulty)]!)
  const distance = speed * hours
  const variant = rng.int(0, 2)

  if (variant === 0) {
    return make(
      'geschwindigkeit',
      difficulty,
      `Ein Fahrzeug fährt ${hours} Stunden lang mit ${speed} km/h. Wie viele Kilometer legt es zurück?`,
      distance,
      { speed, hours, distance, variant: 'weg' },
      'km',
    )
  }
  if (variant === 1) {
    return make(
      'geschwindigkeit',
      difficulty,
      `${distance} km in ${hours} Stunden. Wie hoch ist die Geschwindigkeit?`,
      speed,
      { speed, hours, distance, variant: 'tempo' },
      'km/h',
    )
  }
  return make(
    'geschwindigkeit',
    difficulty,
    `${distance} km bei ${speed} km/h. Wie viele Stunden dauert die Fahrt?`,
    hours,
    { speed, hours, distance, variant: 'zeit' },
    'h',
  )
}

function mischung(rng: Rng, difficulty: number): ArithmeticTrial {
  const scale = [2, 4, 8, 12][tier(difficulty)]!
  for (let attempt = 0; attempt < 64; attempt++) {
    const a = rng.int(1, scale)
    const b = rng.int(1, scale)
    const divisor = gcd(a, b)
    const aReduced = a / divisor
    const bReduced = b / divisor
    const step = rng.int(1, tier(difficulty) === 0 ? 3 : 8)
    const result = rng.int(10, 80)
    const strong = result + bReduced * step
    const weak = result - aReduced * step
    if (weak < 0 || strong > 100 || weak === strong) continue
    return make(
      'mischung',
      difficulty,
      `${a} Liter mit ${strong} % und ${b} Liter mit ${weak} % werden gemischt. Wie viel Prozent hat die Mischung?`,
      result,
      { a, b, strong, weak, result },
      '%',
    )
  }
  return prozentwert(rng, difficulty)
}

const WEIGHTS: readonly (readonly [ItemType, number])[] = [
  ['prozentwert', 3],
  ['prozentsatz', 2],
  ['grundwert', 2],
  ['bruchteil', 2],
  ['multiplikation', 3],
  ['division', 3],
  ['dreisatz', 2],
  ['zuschlag', 2],
  ['rabatt', 2],
  ['geschwindigkeit', 2],
  ['mischung', 1],
]

export function generateArithmetic(difficulty: number, rng: Rng): ArithmeticTrial {
  const available = tier(difficulty) === 0
    ? WEIGHTS.filter(([type]) => type !== 'mischung' && type !== 'grundwert')
    : WEIGHTS
  const itemType = rng.weighted(available)

  switch (itemType) {
    case 'prozentwert':
      return prozentwert(rng, difficulty)
    case 'prozentsatz':
      return prozentsatz(rng, difficulty)
    case 'grundwert':
      return grundwert(rng, difficulty)
    case 'bruchteil':
      return bruchteil(rng, difficulty)
    case 'multiplikation':
      return multiplikation(rng, difficulty)
    case 'division':
      return division(rng, difficulty)
    case 'dreisatz':
      return dreisatz(rng, difficulty)
    case 'zuschlag':
      return zuschlagOderRabatt(rng, difficulty, 'zuschlag')
    case 'rabatt':
      return zuschlagOderRabatt(rng, difficulty, 'rabatt')
    case 'geschwindigkeit':
      return geschwindigkeit(rng, difficulty)
    case 'mischung':
      return mischung(rng, difficulty)
  }
}
