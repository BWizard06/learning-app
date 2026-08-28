import type { Rng } from '~~/shared/rng'
import type { Trial } from '~~/shared/types'

export interface BlockSpot {
  x: number
  y: number
}

export const BLOCKS: readonly BlockSpot[] = [
  { x: 0.171, y: 0.133 },
  { x: 0.578, y: 0.103 },
  { x: 0.885, y: 0.303 },
  { x: 0.354, y: 0.39 },
  { x: 0.106, y: 0.631 },
  { x: 0.655, y: 0.569 },
  { x: 0.858, y: 0.806 },
  { x: 0.431, y: 0.862 },
  { x: 0.13, y: 0.918 },
]

export const BOARD_ASPECT = 1.15
export const BLOCK_RATIO = 0.18

export const MIN_SPAN = 2
export const MAX_SPAN = 9

export const STEP_MS = 700
export const GAP_MS = 300
export const LEAD_MS = 600

export const ITEM_TYPES = ['vorwaerts', 'rueckwaerts'] as const

export type Direction = (typeof ITEM_TYPES)[number]

export interface CorsiPayload {
  direction: Direction
  sequence: number[]
  length: number
  prompt: string
  stepMs: number
  gapMs: number
  leadMs: number
}

export type CorsiTrial = Trial<CorsiPayload, number[]>

const PROMPTS: Record<Direction, string> = {
  vorwaerts: 'Tippe die Felder in derselben Reihenfolge',
  rueckwaerts: 'Tippe die Felder in umgekehrter Reihenfolge',
}

const INDICES: readonly number[] = BLOCKS.map((_, index) => index)

export function spanLengthFor(difficulty: number): number {
  const rounded = Math.round(difficulty)
  if (!Number.isFinite(rounded)) return MIN_SPAN
  return Math.min(MAX_SPAN, Math.max(MIN_SPAN, rounded))
}

export function directionFor(seed: number): Direction {
  let hash = (seed >>> 0) ^ 0x9e3779b9
  hash = Math.imul(hash ^ (hash >>> 15), 2246822519) >>> 0
  hash = Math.imul(hash ^ (hash >>> 13), 3266489917) >>> 0
  hash = (hash ^ (hash >>> 16)) >>> 0
  return ((hash >>> 11) & 1) === 0 ? 'vorwaerts' : 'rueckwaerts'
}

export function expectedTaps(sequence: readonly number[], direction: Direction): number[] {
  const taps = sequence.slice()
  return direction === 'rueckwaerts' ? taps.reverse() : taps
}

export function tapList(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  const taps: number[] = []
  for (const entry of value) {
    const numeric = typeof entry === 'number' ? entry : Number(entry)
    if (!Number.isInteger(numeric) || numeric < 0 || numeric >= BLOCKS.length) return []
    taps.push(numeric)
  }
  return taps
}

export function generateCorsi(difficulty: number, rng: Rng): CorsiTrial {
  const length = spanLengthFor(difficulty)
  const direction = directionFor(rng.seed)
  const sequence = rng.sample(INDICES, length)

  return {
    itemType: direction,
    difficulty,
    params: {
      type: direction,
      length,
      sequence,
      stepMs: STEP_MS,
      gapMs: GAP_MS,
    },
    payload: {
      direction,
      sequence,
      length,
      prompt: PROMPTS[direction],
      stepMs: STEP_MS,
      gapMs: GAP_MS,
      leadMs: LEAD_MS,
    },
    answer: expectedTaps(sequence, direction),
  }
}
