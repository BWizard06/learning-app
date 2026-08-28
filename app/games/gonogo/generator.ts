import type { Rng } from '~~/shared/rng'
import type { Trial } from '~~/shared/types'

export const ITEM_TYPES = ['go', 'nogo'] as const

export type ItemType = (typeof ITEM_TYPES)[number]

export const NOGO_LETTER = 'X'
export const GO_SHARE = 0.75
export const RULE_TEXT = 'Tippe bei jedem Buchstaben, nur beim X nicht.'

export type Segment = readonly [number, number, number, number]

export const GLYPHS: Readonly<Record<string, readonly Segment[]>> = {
  A: [
    [28, 82, 50, 18],
    [50, 18, 72, 82],
    [36.6, 57, 63.4, 57],
  ],
  E: [
    [72, 18, 28, 18],
    [28, 18, 28, 82],
    [28, 82, 72, 82],
    [28, 50, 66, 50],
  ],
  F: [
    [72, 18, 28, 18],
    [28, 18, 28, 82],
    [28, 50, 66, 50],
  ],
  H: [
    [28, 18, 28, 82],
    [72, 18, 72, 82],
    [28, 50, 72, 50],
  ],
  I: [
    [50, 18, 50, 82],
    [34, 18, 66, 18],
    [34, 82, 66, 82],
  ],
  K: [
    [28, 18, 28, 82],
    [70, 18, 28, 50],
    [28, 50, 70, 82],
  ],
  L: [
    [28, 18, 28, 82],
    [28, 82, 70, 82],
  ],
  M: [
    [28, 82, 28, 18],
    [28, 18, 50, 54],
    [50, 54, 72, 18],
    [72, 18, 72, 82],
  ],
  N: [
    [28, 82, 28, 18],
    [28, 18, 72, 82],
    [72, 82, 72, 18],
  ],
  T: [
    [28, 18, 72, 18],
    [50, 18, 50, 82],
  ],
  V: [
    [28, 18, 50, 82],
    [50, 82, 72, 18],
  ],
  W: [
    [26, 18, 36, 82],
    [36, 82, 50, 38],
    [50, 38, 64, 82],
    [64, 82, 74, 18],
  ],
  X: [
    [28, 18, 72, 82],
    [72, 18, 28, 82],
  ],
  Y: [
    [28, 18, 50, 50],
    [72, 18, 50, 50],
    [50, 50, 50, 82],
  ],
  Z: [
    [28, 18, 72, 18],
    [72, 18, 28, 82],
    [28, 82, 72, 82],
  ],
}

export const GERADE_LETTERS = ['E', 'F', 'H', 'I', 'L', 'T'] as const
export const SCHRAEGE_LETTERS = ['A', 'K', 'M', 'N', 'V', 'W', 'Y', 'Z'] as const

const WINDOWS: readonly number[] = [900, 800, 700, 600, 500]
const SCHRAEG_SHARES: readonly number[] = [0.15, 0.35, 0.55, 0.75, 0.9]

function level(difficulty: number): number {
  const rounded = Math.round(difficulty)
  return Math.min(WINDOWS.length, Math.max(1, rounded)) - 1
}

export function windowMsFor(difficulty: number): number {
  return WINDOWS[level(difficulty)]!
}

export function schraegShareFor(difficulty: number): number {
  return SCHRAEG_SHARES[level(difficulty)]!
}

function fmt(value: number): string {
  return String(Math.round(value * 100) / 100)
}

export function glyphPath(letter: string): string {
  const segments = GLYPHS[letter]
  if (!segments) throw new RangeError(`glyphPath: unknown letter ${letter}`)
  return segments
    .map(([x1, y1, x2, y2]) => `M${fmt(x1)} ${fmt(y1)}L${fmt(x2)} ${fmt(y2)}`)
    .join('')
}

export function letterSvg(letter: string): string {
  return [
    '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img"',
    ' fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"',
    ' stroke-linejoin="round">',
    `<title>Buchstabe ${letter}</title>`,
    `<path d="${glyphPath(letter)}"/>`,
    '</svg>',
  ].join('')
}

export interface GoNoGoPayload {
  rule: string
  letter: string
  svg: string
  go: boolean
  windowMs: number
}

export type GoNoGoTrial = Trial<GoNoGoPayload, boolean | null>

export function generateStimulus(difficulty: number, rng: Rng): GoNoGoTrial {
  const windowMs = windowMsFor(difficulty)
  const go = rng.bool(GO_SHARE)
  const schraeg = go ? rng.bool(schraegShareFor(difficulty)) : true
  const letter = go ? rng.pick(schraeg ? SCHRAEGE_LETTERS : GERADE_LETTERS) : NOGO_LETTER
  const itemType: ItemType = go ? 'go' : 'nogo'

  return {
    itemType,
    difficulty,
    params: { type: itemType, letter, go, schraeg, windowMs },
    payload: { rule: RULE_TEXT, letter, svg: letterSvg(letter), go, windowMs },
    answer: go ? true : null,
  }
}
