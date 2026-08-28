import type { Rng } from '~~/shared/rng'
import type { Trial } from '~~/shared/types'

export const ITEM_TYPES = ['vorwaerts', 'rueckwaerts'] as const

export type ItemType = (typeof ITEM_TYPES)[number]

export const MIN_LENGTH = 3
export const MAX_LENGTH = 12
export const LOWEST_DIGIT = 1
export const HIGHEST_DIGIT = 9
export const DIGIT_MS = 1000
export const GAP_MS = 200

export interface SpanPayload {
  digits: number[]
  direction: ItemType
  prompt: string
  hint: string
  digitMs: number
  gapMs: number
}

export type SpanTrial = Trial<SpanPayload, number>

const PROMPTS: Record<ItemType, string> = {
  vorwaerts: 'Ziffern merken und in gleicher Reihenfolge eintippen',
  rueckwaerts: 'Ziffern merken und rückwärts eintippen',
}

const HINTS: Record<ItemType, string> = {
  vorwaerts: 'gleiche Reihenfolge',
  rueckwaerts: 'rückwärts',
}

export function spanLength(difficulty: number): number {
  if (!Number.isFinite(difficulty)) return MIN_LENGTH
  return Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, Math.round(difficulty)))
}

export function directionForSeed(seed: number): ItemType {
  const index = Math.abs(Math.trunc(seed)) % ITEM_TYPES.length
  return ITEM_TYPES[index]!
}

function digitAfter(rng: Rng, previous: number): number {
  const span = HIGHEST_DIGIT - LOWEST_DIGIT + 1
  if (previous < LOWEST_DIGIT) return rng.int(LOWEST_DIGIT, HIGHEST_DIGIT)
  const step = rng.int(1, span - 1)
  return ((previous - LOWEST_DIGIT + step) % span) + LOWEST_DIGIT
}

export function generateSpan(difficulty: number, rng: Rng): SpanTrial {
  const length = spanLength(difficulty)
  const direction = directionForSeed(rng.seed)

  const digits: number[] = []
  let previous = 0
  for (let i = 0; i < length; i++) {
    previous = digitAfter(rng, previous)
    digits.push(previous)
  }

  const typed = direction === 'rueckwaerts' ? digits.slice().reverse() : digits.slice()

  return {
    itemType: direction,
    difficulty: length,
    params: { type: direction, length, digits: digits.slice() },
    payload: {
      digits: digits.slice(),
      direction,
      prompt: PROMPTS[direction],
      hint: HINTS[direction],
      digitMs: DIGIT_MS,
      gapMs: GAP_MS,
    },
    answer: Number(typed.join('')),
  }
}
