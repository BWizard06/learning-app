export type Construct =
  | 'rechnen'
  | 'logik'
  | 'sprache'
  | 'wortfluss'
  | 'konzentration'
  | 'gedaechtnis'
  | 'text'

export type GameMode = 'sprint' | 'block' | 'span' | 'reading'

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export type JsonObject = { [key: string]: JsonValue }

export interface ChoiceOption {
  id: string
  label: string
  svg?: string
}

export interface Trial<TPayload = unknown, TAnswer = JsonValue> {
  itemType: string
  difficulty: number
  params: JsonObject
  payload: TPayload
  answer: TAnswer
  options?: ChoiceOption[]
  correctIndex?: number
}

export interface TrialBlock<TPayload = unknown, TAnswer = JsonValue> {
  kind: 'block'
  itemType: string
  difficulty: number
  params: JsonObject
  payload: TPayload
  trials: Trial<TPayload, TAnswer>[]
}

export function isTrialBlock(value: unknown): value is TrialBlock {
  return typeof value === 'object' && value !== null && (value as { kind?: string }).kind === 'block'
}

export interface TrialResult {
  idx: number
  itemType: string
  difficulty: number
  params: JsonObject
  response: JsonValue
  correct: boolean
  rtMs: number
  presentedAt: number
}

export interface RawScore {
  raw: number
  accuracy: number
  metrics: Record<string, number>
}

export interface NoteThresholds {
  raw1: number
  raw4: number
  raw6: number
}

export type NoteSource = 'thresholds' | 'personal'

export interface Note {
  value: number
  source: NoteSource
  sampleSize: number
}

export interface GameDefinition<TPayload = any, TAnswer = any> {
  slug: string
  name: string
  construct: Construct
  blurb: string
  mode: GameMode
  defaultDurationS: number
  itemCount?: number
  difficultyRange: [number, number]
  thresholds: NoteThresholds
  weight(difficulty: number): number
  generate(difficulty: number, rng: Rng): Trial<TPayload, TAnswer> | TrialBlock<TPayload, TAnswer>
  score(trials: TrialResult[], durationS: number): RawScore
  isCorrect?(trial: Trial<TPayload, TAnswer>, response: JsonValue): boolean
}

export interface SessionPayload {
  id: string
  gameSlug: string
  startedAt: number
  finishedAt: number
  durationMs: number
  difficulty: number
  rawScore: number
  accuracy: number
  seed: number
  mode: GameMode
  deviceId: string
  metrics: Record<string, number>
  trials: TrialResult[]
}

export interface SessionRecord {
  id: string
  gameSlug: string
  startedAt: number
  finishedAt: number | null
  durationMs: number
  difficulty: number
  rawScore: number
  accuracy: number
  note: number | null
  seed: number
  mode: string
  deviceId: string | null
  syncedAt: number | null
}

export const CONSTRUCT_LABELS: Record<Construct, string> = {
  rechnen: 'Rechnerisches Denken',
  logik: 'Logisches Denken',
  sprache: 'Sprachliches Denken',
  wortfluss: 'Wortflüssigkeit',
  konzentration: 'Konzentrationsleistung',
  gedaechtnis: 'Gedächtnis',
  text: 'Textverständnis',
}

export const CONSTRUCT_SHORT_LABELS: Record<Construct, string> = {
  rechnen: 'Rechnen',
  logik: 'Logik',
  sprache: 'Sprache',
  wortfluss: 'Wortfluss',
  konzentration: 'Konzentration',
  gedaechtnis: 'Gedächtnis',
  text: 'Text',
}

export const EXAM_CONSTRUCTS: Construct[] = [
  'rechnen',
  'logik',
  'sprache',
  'wortfluss',
  'konzentration',
  'text',
]

export const PASS_NOTE = 4

import type { Rng } from '../rng'
export type { Rng }
