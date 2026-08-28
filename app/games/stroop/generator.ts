import type { Rng } from '~~/shared/rng'
import type { Trial } from '~~/shared/types'

export const COLORS = ['rot', 'gelb', 'gruen', 'blau'] as const

export type StroopColor = (typeof COLORS)[number]

export const KONGRUENT = 'kongruent'
export const INKONGRUENT = 'inkongruent'

export const ITEM_TYPES = [KONGRUENT, INKONGRUENT] as const

export type StroopItemType = (typeof ITEM_TYPES)[number]

export const KONGRUENT_SHARE = 0.4

const SMALL_PALETTE_SIZE = 3

const BUDGETS_MS: readonly number[] = [2400, 2000, 1700, 1450]

export interface StroopPayload {
  word: StroopColor
  color: StroopColor
  palette: StroopColor[]
  budgetMs: number
}

export type StroopTrial = Trial<StroopPayload, StroopColor>

function level(difficulty: number): number {
  const rounded = Math.round(difficulty)
  const clamped = Math.min(BUDGETS_MS.length, Math.max(1, rounded))
  return clamped - 1
}

export function paletteFor(difficulty: number): StroopColor[] {
  return level(difficulty) === 0 ? COLORS.slice(0, SMALL_PALETTE_SIZE) : COLORS.slice()
}

export function budgetFor(difficulty: number): number {
  return BUDGETS_MS[level(difficulty)]!
}

export function generateStroop(difficulty: number, rng: Rng): StroopTrial {
  const palette = paletteFor(difficulty)
  const budgetMs = budgetFor(difficulty)
  const matching = rng.bool(KONGRUENT_SHARE)
  const word = rng.pick(palette)
  const color = matching ? word : rng.pick(palette.filter((entry) => entry !== word))
  const itemType: StroopItemType = matching ? KONGRUENT : INKONGRUENT

  return {
    itemType,
    difficulty,
    params: { type: itemType, word, color, palette: palette.slice(), budgetMs },
    payload: { word, color, palette, budgetMs },
    answer: color,
  }
}
