import type { Rng } from '~~/shared/rng'
import type { JsonObject, JsonValue, Trial } from '~~/shared/types'

export type D2Letter = 'd' | 'p'

export interface D2Char {
  letter: D2Letter
  above: number
  below: number
}

export type D2Trial = Trial<D2Char[], number[]>

export const ITEM_TYPE = 'zeile'

export const MIN_MARKS = 1
export const MAX_MARKS = 4
export const MAX_MARKS_PER_SIDE = 2

const SHAPES: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 0],
  [0, 2],
  [1, 1],
  [2, 0],
  [1, 2],
  [2, 1],
  [2, 2],
]

const TWO_MARK_SHAPES = SHAPES.filter(([above, below]) => above + below === 2)
const OTHER_SHAPES = SHAPES.filter(([above, below]) => above + below !== 2)

const ROW_LENGTHS: readonly number[] = [16, 17, 19, 20, 22, 24]
const HARD_SHARES: readonly number[] = [0.35, 0.45, 0.55, 0.65, 0.78, 0.9]

const TARGET_SHARE_MIN = 0.41
const TARGET_SHARE_MAX = 0.49

export function isTarget(char: D2Char): boolean {
  return char.letter === 'd' && char.above + char.below === 2
}

export function isHardDistractor(char: D2Char): boolean {
  if (isTarget(char)) return false
  if (char.letter === 'd') return true
  return char.above + char.below === 2
}

function level(difficulty: number): number {
  const rounded = Math.round(difficulty)
  const clamped = Math.min(ROW_LENGTHS.length, Math.max(1, rounded))
  return clamped - 1
}

export function rowLengthFor(difficulty: number): number {
  return ROW_LENGTHS[level(difficulty)]!
}

export function hardShareFor(difficulty: number): number {
  return HARD_SHARES[level(difficulty)]!
}

function shaped(letter: D2Letter, shape: readonly [number, number]): D2Char {
  return { letter, above: shape[0]!, below: shape[1]! }
}

function target(rng: Rng): D2Char {
  return shaped('d', rng.pick(TWO_MARK_SHAPES))
}

function hardDistractor(rng: Rng): D2Char {
  return rng.bool(0.5) ? shaped('d', rng.pick(OTHER_SHAPES)) : shaped('p', rng.pick(TWO_MARK_SHAPES))
}

function easyDistractor(rng: Rng): D2Char {
  return shaped('p', rng.pick(OTHER_SHAPES))
}

function toJson(char: D2Char): JsonObject {
  return { letter: char.letter, above: char.above, below: char.below }
}

export function charsFromParams(params: JsonObject): D2Char[] {
  const raw = params.chars
  if (!Array.isArray(raw)) return []
  const chars: D2Char[] = []
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue
    const record = entry as { [key: string]: JsonValue }
    const letter = record.letter === 'p' ? 'p' : 'd'
    chars.push({ letter, above: Number(record.above) || 0, below: Number(record.below) || 0 })
  }
  return chars
}

export function indexList(value: unknown, limit?: number): number[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<number>()
  for (const entry of value) {
    const numeric = typeof entry === 'number' ? entry : Number(entry)
    if (!Number.isInteger(numeric) || numeric < 0) continue
    if (limit !== undefined && numeric >= limit) continue
    seen.add(numeric)
  }
  return [...seen].sort((a, b) => a - b)
}

export function targetIndices(chars: readonly D2Char[]): number[] {
  const indices: number[] = []
  for (let i = 0; i < chars.length; i++) {
    if (isTarget(chars[i]!)) indices.push(i)
  }
  return indices
}

export function generateRow(difficulty: number, rng: Rng): D2Trial {
  const length = rowLengthFor(difficulty)
  const hardShare = hardShareFor(difficulty)
  const lo = Math.ceil(length * TARGET_SHARE_MIN)
  const hi = Math.floor(length * TARGET_SHARE_MAX)
  const targetCount = rng.int(lo, Math.max(lo, hi))

  const pool: D2Char[] = []
  for (let i = 0; i < targetCount; i++) pool.push(target(rng))
  for (let i = targetCount; i < length; i++) {
    pool.push(rng.bool(hardShare) ? hardDistractor(rng) : easyDistractor(rng))
  }

  const chars = rng.shuffle(pool)
  const targets = targetIndices(chars)

  return {
    itemType: ITEM_TYPE,
    difficulty,
    params: {
      type: ITEM_TYPE,
      length,
      targetCount,
      hardShare,
      chars: chars.map(toJson),
      targets,
    },
    payload: chars,
    answer: targets,
  }
}
