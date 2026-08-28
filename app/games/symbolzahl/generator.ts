import { createRng } from '~~/shared/rng'
import type { Rng } from '~~/shared/rng'
import type { Trial } from '~~/shared/types'

export const ITEM_TYPES = ['symbolzahl'] as const

export type ItemType = (typeof ITEM_TYPES)[number]

export const SYMBOL_IDS = [
  'kreuz',
  'tau',
  'winkel',
  'bogen',
  'doppellinie',
  'dreieck',
  'spitz',
  'punktkreis',
  'zickzack',
] as const

export type SymbolId = (typeof SYMBOL_IDS)[number]

export const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

const LEGEND_SALT = 0x9e3779b9

const SVG_HEAD =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">'

const SVG_BODY: Record<SymbolId, string> = {
  kreuz: '<path d="M5 12 L19 12"/><path d="M12 5 L12 19"/>',
  tau: '<path d="M5 6 L19 6"/><path d="M12 6 L12 19"/>',
  winkel: '<path d="M7 5 L7 18 L18 18"/>',
  bogen: '<path d="M4 16 A 8 8 0 0 1 20 16"/>',
  doppellinie: '<path d="M4 9 L20 9"/><path d="M4 15 L20 15"/>',
  dreieck: '<path d="M12 4 L20 19 L4 19 Z"/>',
  spitz: '<path d="M5 16 L12 8 L19 16"/>',
  punktkreis:
    '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/>',
  zickzack: '<path d="M3 16 L7.5 8 L12 16 L16.5 8 L21 16"/>',
}

export const CONFUSABILITY: Record<SymbolId, number> = {
  kreuz: 0.15,
  punktkreis: 0.2,
  doppellinie: 0.25,
  dreieck: 0.45,
  bogen: 0.6,
  zickzack: 0.65,
  spitz: 0.75,
  winkel: 0.8,
  tau: 0.85,
}

export function symbolToSvg(id: SymbolId): string {
  const body = SVG_BODY[id]
  if (!body) throw new RangeError(`symbolToSvg: unknown symbol ${id}`)
  return `${SVG_HEAD}${body}</svg>`
}

export interface LegendEntry {
  id: SymbolId
  digit: number
  svg: string
}

export interface SymbolzahlPayload {
  symbolId: SymbolId
  symbolSvg: string
  legend: LegendEntry[]
}

export type SymbolzahlTrial = Trial<SymbolzahlPayload, number>

function saltedRng(seed: number, salt: number): Rng {
  return createRng((seed ^ salt) >>> 0)
}

export function legendForSeed(seed: number): number[] {
  return saltedRng(seed, LEGEND_SALT).shuffle(DIGITS)
}

function digitOrderOf(legend: readonly number[]): number[] {
  return legend.map((_, index) => index).sort((a, b) => legend[a]! - legend[b]!)
}

export function legendOrderForSeed(seed: number): number[] {
  return digitOrderOf(legendForSeed(seed))
}

export function probeWeight(id: SymbolId, difficulty: number): number {
  const confusability = CONFUSABILITY[id]
  const t = Math.min(1, Math.max(0, (difficulty - 1) / 3))
  return 0.25 + (1 - t) * (1 - confusability) + t * confusability
}

export function generateSymbolzahl(difficulty: number, rng: Rng): SymbolzahlTrial {
  const legend = legendForSeed(rng.seed)
  const order = legendOrderForSeed(rng.seed)

  const index = rng.pickIndex(SYMBOL_IDS.map((id) => probeWeight(id, difficulty)))
  const symbolId = SYMBOL_IDS[index]!
  const digit = legend[index]!

  const entries: LegendEntry[] = order.map((position) => {
    const id = SYMBOL_IDS[position]!
    return { id, digit: legend[position]!, svg: symbolToSvg(id) }
  })

  return {
    itemType: 'symbolzahl',
    difficulty,
    params: {
      type: 'symbolzahl',
      symbol: symbolId,
      digit,
      legend: legend.slice(),
      order: order.slice(),
    },
    payload: {
      symbolId,
      symbolSvg: symbolToSvg(symbolId),
      legend: entries,
    },
    answer: digit,
  }
}
