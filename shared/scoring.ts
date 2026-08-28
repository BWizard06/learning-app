import type { NoteThresholds, Note, NoteSource } from './types'

export const NOTE_MIN = 1
export const NOTE_MAX = 6
export const PASS_NOTE = 4
export const PERSONAL_NORM_MIN_SESSIONS = 20
export const PERSONAL_NORM_ANCHOR_SESSIONS = 10
export const PERSONAL_NORM_WINDOW_DAYS = 90
export const NOTES_PER_SD = 1

export function clampNote(value: number): number {
  if (Number.isNaN(value)) return NOTE_MIN
  return Math.min(NOTE_MAX, Math.max(NOTE_MIN, value))
}

export function roundNote(value: number): number {
  return Math.round(value * 100) / 100
}

export function formatNote(value: number): string {
  return value.toFixed(1).replace('.', ',')
}

export function noteFromThresholds(raw: number, thresholds: NoteThresholds): number {
  const { raw1, raw4, raw6 } = thresholds
  if (!(raw1 < raw4 && raw4 < raw6)) {
    throw new RangeError(`thresholds must be strictly increasing, got ${raw1}/${raw4}/${raw6}`)
  }
  if (raw <= raw1) return NOTE_MIN
  if (raw >= raw6) return NOTE_MAX
  if (raw <= raw4) return 1 + ((raw - raw1) / (raw4 - raw1)) * 3
  return 4 + ((raw - raw4) / (raw6 - raw4)) * 2
}

export function median(values: readonly number[]): number {
  if (values.length === 0) throw new RangeError('median: empty list')
  const sorted = values.slice().sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

export function standardDeviation(values: readonly number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

export interface PersonalNorm {
  anchorRaw: number
  sd: number
  sampleSize: number
}

export function buildPersonalNorm(
  rawScoresOldestFirst: readonly number[],
  rawScoresInWindow: readonly number[],
): PersonalNorm | null {
  if (rawScoresOldestFirst.length < PERSONAL_NORM_MIN_SESSIONS) return null
  if (rawScoresInWindow.length < 2) return null
  const anchorRaw = median(rawScoresOldestFirst.slice(0, PERSONAL_NORM_ANCHOR_SESSIONS))
  const sd = standardDeviation(rawScoresInWindow)
  if (!Number.isFinite(sd) || sd <= 0) return null
  return { anchorRaw, sd, sampleSize: rawScoresInWindow.length }
}

export function noteFromPersonalNorm(raw: number, norm: PersonalNorm): number {
  return PASS_NOTE + ((raw - norm.anchorRaw) / norm.sd) * NOTES_PER_SD
}

export function computeNote(
  raw: number,
  thresholds: NoteThresholds,
  norm: PersonalNorm | null,
): Note {
  const source: NoteSource = norm ? 'personal' : 'thresholds'
  const value = norm ? noteFromPersonalNorm(raw, norm) : noteFromThresholds(raw, thresholds)
  return {
    value: roundNote(clampNote(value)),
    source,
    sampleSize: norm ? norm.sampleSize : 0,
  }
}

export function linearWeight(
  range: readonly [number, number],
  minWeight = 1,
  maxWeight = 3,
): (difficulty: number) => number {
  const [lo, hi] = range
  if (hi <= lo) throw new RangeError(`difficultyRange must increase, got ${lo}..${hi}`)
  return (difficulty: number) => {
    const t = Math.min(1, Math.max(0, (difficulty - lo) / (hi - lo)))
    return minWeight + t * (maxWeight - minWeight)
  }
}

export function weightedThroughput(
  results: readonly { correct: boolean; difficulty: number }[],
  durationS: number,
  weight: (difficulty: number) => number,
): number {
  if (durationS <= 0) return 0
  const total = results.reduce((sum, r) => (r.correct ? sum + weight(r.difficulty) : sum), 0)
  return total / (durationS / 60)
}

export function accuracyOf(results: readonly { correct: boolean }[]): number {
  if (results.length === 0) return 0
  return results.filter((r) => r.correct).length / results.length
}
