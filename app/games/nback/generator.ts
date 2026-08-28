import type { Rng } from '~~/shared/rng'
import type { JsonObject, Trial, TrialBlock } from '~~/shared/types'

export const ITEM_TYPES = ['visuell', 'verbal', 'dual'] as const

export type ItemType = (typeof ITEM_TYPES)[number]

export type Channel = 'position' | 'letter'

export const CELLS: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8]
export const CENTER_CELL = 4
export const POSITIONS: readonly number[] = [0, 1, 2, 3, 5, 6, 7, 8]
export const LETTERS: readonly string[] = ['B', 'F', 'H', 'K', 'M', 'Q', 'R', 'T']

export const MIN_N = 1
export const MAX_N = 4
export const STREAM_LENGTH = 100
export const BASE_MS = 2500
export const STEP_MS = 200
export const FEEDBACK_MS = 260
export const MATCH_SHARE_MIN = 0.26
export const MATCH_SHARE_MAX = 0.34
export const LURE_SHARE = 0.3

const POSITION_ONLY: readonly Channel[] = ['position']
const LETTER_ONLY: readonly Channel[] = ['letter']
const BOTH_CHANNELS: readonly Channel[] = ['position', 'letter']

export type NbackPayload = {
  variant: ItemType
  n: number
  index: number
  total: number
  position: number | null
  letter: string | null
  durationMs: number
}

export type NbackAnswer = {
  position: boolean
  letter: boolean
}

export type NbackResponse = {
  position: boolean
  letter: boolean
  positionRtMs: number
  letterRtMs: number
}

export type NbackTrial = Trial<NbackPayload, NbackAnswer>

export type NbackBlock = TrialBlock<NbackPayload, NbackAnswer>

export function nFor(difficulty: number): number {
  if (!Number.isFinite(difficulty)) return MIN_N
  return Math.min(MAX_N, Math.max(MIN_N, Math.round(difficulty)))
}

export function durationMsFor(difficulty: number): number {
  return BASE_MS - STEP_MS * nFor(difficulty)
}

export function variantForSeed(seed: number): ItemType {
  return ITEM_TYPES[Math.abs(seed) % ITEM_TYPES.length]!
}

export function channelsFor(variant: string): readonly Channel[] {
  if (variant === 'visuell') return POSITION_ONLY
  if (variant === 'verbal') return LETTER_ONLY
  return BOTH_CHANNELS
}

export function channelsFromParams(params: JsonObject): readonly Channel[] {
  return channelsFor(typeof params.type === 'string' ? params.type : '')
}

export function matchesFromParams(params: JsonObject): NbackAnswer {
  return { position: params.positionMatch === true, letter: params.letterMatch === true }
}

function toMs(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : 0
}

export function readResponse(value: unknown): NbackResponse {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { position: false, letter: false, positionRtMs: 0, letterRtMs: 0 }
  }
  const record = value as { [key: string]: unknown }
  return {
    position: record.position === true,
    letter: record.letter === true,
    positionRtMs: toMs(record.positionRtMs),
    letterRtMs: toMs(record.letterRtMs),
  }
}

export function rtOf(response: NbackResponse, channel: Channel): number {
  return channel === 'position' ? response.positionRtMs : response.letterRtMs
}

export function stepText(n: number): string {
  return n === 1 ? 'einem Schritt' : `${n} Schritten`
}

export function ruleTextFor(variant: ItemType, n: number): string {
  const back = stepText(n)
  if (variant === 'visuell') return `Tippe, wenn das Feld gleich ist wie vor ${back}.`
  if (variant === 'verbal') return `Tippe, wenn der Buchstabe gleich ist wie vor ${back}.`
  return `Tippe Position und Buchstabe je einzeln, wenn sie gleich sind wie vor ${back}.`
}

export function levelTextFor(variant: ItemType, n: number): string {
  const label = variant === 'visuell' ? 'Felder' : variant === 'verbal' ? 'Buchstaben' : 'Doppelt'
  return `${label} · ${n} zurück`
}

interface Stream<T> {
  items: T[]
  matches: boolean[]
}

function buildStream<T>(values: readonly T[], n: number, length: number, rng: Rng): Stream<T> {
  const eligible: number[] = []
  for (let i = n; i < length; i++) eligible.push(i)

  const lo = Math.ceil(length * MATCH_SHARE_MIN)
  const hi = Math.floor(length * MATCH_SHARE_MAX)
  const wanted = rng.int(Math.min(lo, hi), Math.max(lo, hi))
  const count = Math.min(eligible.length, wanted)

  const matches = new Array<boolean>(length).fill(false)
  for (const index of rng.sample(eligible, count)) matches[index] = true

  const items: T[] = []
  for (let i = 0; i < length; i++) {
    if (i < n) {
      items.push(rng.pick(values))
      continue
    }
    if (matches[i]) {
      items.push(items[i - n]!)
      continue
    }

    const forbidden = items[i - n]!
    const nearby: T[] = []
    if (i - n - 1 >= 0) nearby.push(items[i - n - 1]!)
    if (n >= 2) nearby.push(items[i - n + 1]!)
    const lures = nearby.filter((value) => value !== forbidden)

    if (lures.length > 0 && rng.bool(LURE_SHARE)) {
      items.push(rng.pick(lures))
      continue
    }
    items.push(rng.pick(values.filter((value) => value !== forbidden)))
  }

  return { items, matches }
}

function countTrue(flags: readonly boolean[]): number {
  return flags.reduce((sum, flag) => (flag ? sum + 1 : sum), 0)
}

export function generateStream(difficulty: number, rng: Rng): NbackBlock {
  const n = nFor(difficulty)
  const variant = variantForSeed(rng.seed)
  const durationMs = BASE_MS - STEP_MS * n
  const length = STREAM_LENGTH

  const usesPosition = variant !== 'verbal'
  const usesLetter = variant !== 'visuell'

  const positions = usesPosition ? buildStream(POSITIONS, n, length, rng) : null
  const letters = usesLetter ? buildStream(LETTERS, n, length, rng) : null

  const trials: NbackTrial[] = []
  for (let i = 0; i < length; i++) {
    const position = positions ? positions.items[i]! : null
    const letter = letters ? letters.items[i]! : null
    const positionMatch = positions ? positions.matches[i]! : false
    const letterMatch = letters ? letters.matches[i]! : false

    trials.push({
      itemType: variant,
      difficulty: n,
      params: {
        type: variant,
        n,
        index: i,
        total: length,
        position,
        letter,
        positionMatch,
        letterMatch,
        durationMs,
      },
      payload: { variant, n, index: i, total: length, position, letter, durationMs },
      answer: { position: positionMatch, letter: letterMatch },
    })
  }

  return {
    kind: 'block',
    itemType: variant,
    difficulty: n,
    params: {
      type: variant,
      n,
      length,
      durationMs,
      positionMatches: positions ? countTrue(positions.matches) : 0,
      letterMatches: letters ? countTrue(letters.matches) : 0,
    },
    payload: trials[0]!.payload,
    trials,
  }
}
