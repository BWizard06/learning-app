import type { Rng } from '~~/shared/rng'
import type { Trial } from '~~/shared/types'

export const ITEM_TYPES = ['identisch', 'zifferntausch', 'aehnliche-glyphe', 'ein-zeichen'] as const

export type ItemType = (typeof ITEM_TYPES)[number]

export type Line = 'top' | 'bottom'

export interface ComparePayload {
  top: string
  bottom: string
  length: number
}

export type CompareTrial = Trial<ComparePayload, boolean>

export const DIGITS = '0123456789'
export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export const DIGIT_LIST: readonly string[] = DIGITS.split('')
export const ALPHABET: readonly string[] = (DIGITS + LETTERS).split('')

export const LOOKALIKE_PAIRS: readonly (readonly [string, string])[] = [
  ['0', 'O'],
  ['1', 'l'],
  ['5', 'S'],
  ['8', 'B'],
  ['6', 'b'],
  ['2', 'Z'],
]

export const LENGTHS: readonly number[] = [6, 8, 10, 13, 15, 18]
export const LOOKALIKE_WEIGHTS: readonly number[] = [1, 1.5, 2.2, 3.2, 4.4, 6]
export const IDENTICAL_SHARE = 0.5

const IN_ALPHABET = new Set(ALPHABET)

const SUBSTITUTIONS: readonly (readonly [string, string])[] = LOOKALIKE_PAIRS.flatMap((pair) => {
  const out: (readonly [string, string])[] = []
  if (IN_ALPHABET.has(pair[0])) out.push([pair[0], pair[1]] as const)
  if (IN_ALPHABET.has(pair[1])) out.push([pair[1], pair[0]] as const)
  return out
})

export function lookalikePartners(char: string): string[] {
  const out: string[] = []
  for (const [first, second] of LOOKALIKE_PAIRS) {
    if (first === char) out.push(second)
    if (second === char) out.push(first)
  }
  return out
}

export function isLookalikePair(a: string, b: string): boolean {
  return LOOKALIKE_PAIRS.some(([first, second]) => (first === a && second === b) || (first === b && second === a))
}

function level(difficulty: number): number {
  const rounded = Math.round(difficulty)
  return Math.min(LENGTHS.length, Math.max(1, rounded)) - 1
}

export function lengthFor(difficulty: number): number {
  return LENGTHS[level(difficulty)]!
}

export function lookalikeWeightFor(difficulty: number): number {
  return LOOKALIKE_WEIGHTS[level(difficulty)]!
}

export function pickItemType(difficulty: number, rng: Rng): ItemType {
  if (rng.bool(IDENTICAL_SHARE)) return 'identisch'
  return rng.weighted<ItemType>([
    ['zifferntausch', 1],
    ['ein-zeichen', 1],
    ['aehnliche-glyphe', lookalikeWeightFor(difficulty)],
  ])
}

function replaceAt(value: string, index: number, char: string): string {
  return value.slice(0, index) + char + value.slice(index + 1)
}

function swapAt(value: string, index: number): string {
  return value.slice(0, index) + value[index + 1]! + value[index]! + value.slice(index + 2)
}

function randomString(length: number, rng: Rng): string {
  let out = ''
  for (let i = 0; i < length; i++) out += rng.pick(ALPHABET)
  return out
}

export function generateComparison(difficulty: number, rng: Rng): CompareTrial {
  const length = lengthFor(difficulty)
  const type = pickItemType(difficulty, rng)
  const drawn = randomString(length, rng)

  let base = drawn
  let variant = drawn
  let position: number | null = null
  let replacement: string | null = null

  if (type === 'zifferntausch') {
    position = rng.int(0, length - 2)
    const first = rng.pick(DIGIT_LIST)
    const second = rng.pick(DIGIT_LIST.filter((digit) => digit !== first))
    base = replaceAt(replaceAt(drawn, position, first), position + 1, second)
    variant = swapAt(base, position)
  } else if (type === 'aehnliche-glyphe') {
    position = rng.int(0, length - 1)
    const [source, partner] = rng.pick(SUBSTITUTIONS)
    base = replaceAt(drawn, position, source)
    replacement = partner
    variant = replaceAt(base, position, partner)
  } else if (type === 'ein-zeichen') {
    position = rng.int(0, length - 1)
    const original = base[position]!
    const blocked = new Set([original, ...lookalikePartners(original)])
    replacement = rng.pick(ALPHABET.filter((char) => !blocked.has(char)))
    variant = replaceAt(base, position, replacement)
  }

  const same = type === 'identisch'
  const line: Line | null = same ? null : rng.bool() ? 'top' : 'bottom'

  return {
    itemType: type,
    difficulty,
    params: { type, length, base, position, replacement, line, same },
    payload: {
      top: line === 'top' ? variant : base,
      bottom: line === 'bottom' ? variant : base,
      length,
    },
    answer: same,
  }
}
