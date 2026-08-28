import type { Rng } from '~~/shared/rng'
import type { JsonObject, Trial } from '~~/shared/types'

export const FORMS = ['A', 'E', 'I', 'O'] as const

export type Form = (typeof FORMS)[number]

export const FIGURES = [1, 2, 3, 4] as const

export type Figure = (typeof FIGURES)[number]

export const VERDICTS = ['folgt', 'folgt-nicht', 'widerspricht'] as const

export type Verdict = (typeof VERDICTS)[number]

export const VERDICT_LABELS: Record<Verdict, string> = {
  folgt: 'folgt zwingend',
  'folgt-nicht': 'folgt nicht',
  widerspricht: 'widerspricht',
}

export const TERMS = [
  'Vögel',
  'Katzen',
  'Musiker',
  'Lampen',
  'Segler',
  'Tassen',
  'Gärtner',
  'Brücken',
  'Wolken',
  'Kissen',
  'Pinsel',
  'Trommeln',
  'Fenster',
  'Schlüssel',
  'Kerzen',
  'Teppiche',
  'Räder',
  'Anker',
  'Nadeln',
  'Bänke',
  'Türme',
  'Körbe',
  'Zelte',
  'Spiegel',
  'Landkarten',
  'Mäntel',
  'Löffel',
  'Vasen',
  'Krüge',
  'Ruder',
] as const

const TERM_INDEXES: readonly number[] = TERMS.map((_, index) => index)

const SUBJECT = 0
const PREDICATE = 1
const MIDDLE = 2

const TERM_COUNT = 3
const CELL_COUNT = 8
const WORLD_COUNT = 256

interface Slot {
  subject: number
  predicate: number
}

const FIGURE_SLOTS: Record<Figure, readonly [Slot, Slot]> = {
  1: [
    { subject: MIDDLE, predicate: PREDICATE },
    { subject: SUBJECT, predicate: MIDDLE },
  ],
  2: [
    { subject: PREDICATE, predicate: MIDDLE },
    { subject: SUBJECT, predicate: MIDDLE },
  ],
  3: [
    { subject: MIDDLE, predicate: PREDICATE },
    { subject: MIDDLE, predicate: SUBJECT },
  ],
  4: [
    { subject: PREDICATE, predicate: MIDDLE },
    { subject: MIDDLE, predicate: SUBJECT },
  ],
}

export interface SyllogismPayload {
  premises: [string, string]
  conclusion: string
}

export type SyllogismTrial = Trial<SyllogismPayload, Verdict>

function holdsInWorld(form: Form, subject: number, predicate: number, world: number): boolean {
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (((world >> cell) & 1) === 0) continue
    if (((cell >> subject) & 1) === 0) continue
    const inPredicate = ((cell >> predicate) & 1) === 1
    if (form === 'A' && !inPredicate) return false
    if (form === 'E' && inPredicate) return false
    if (form === 'I' && inPredicate) return true
    if (form === 'O' && !inPredicate) return true
  }
  return form === 'A' || form === 'E'
}

function satisfactionKey(form: Form, subject: number, predicate: number): string {
  return `${form}${subject}${predicate}`
}

function buildSatisfaction(): Map<string, Uint8Array> {
  const table = new Map<string, Uint8Array>()
  for (const form of FORMS) {
    for (let subject = 0; subject < TERM_COUNT; subject++) {
      for (let predicate = 0; predicate < TERM_COUNT; predicate++) {
        if (subject === predicate) continue
        const flags = new Uint8Array(WORLD_COUNT)
        for (let world = 0; world < WORLD_COUNT; world++) {
          flags[world] = holdsInWorld(form, subject, predicate, world) ? 1 : 0
        }
        table.set(satisfactionKey(form, subject, predicate), flags)
      }
    }
  }
  return table
}

function buildPopulated(): Uint8Array {
  const flags = new Uint8Array(WORLD_COUNT)
  for (let world = 0; world < WORLD_COUNT; world++) {
    let complete = 1
    for (let term = 0; term < TERM_COUNT; term++) {
      let seen = 0
      for (let cell = 0; cell < CELL_COUNT; cell++) {
        if (((world >> cell) & 1) === 1 && ((cell >> term) & 1) === 1) {
          seen = 1
          break
        }
      }
      if (seen === 0) {
        complete = 0
        break
      }
    }
    flags[world] = complete
  }
  return flags
}

const SATISFACTION = buildSatisfaction()
const POPULATED = buildPopulated()

function flagsFor(form: Form, slot: Slot): Uint8Array {
  return SATISFACTION.get(satisfactionKey(form, slot.subject, slot.predicate))!
}

const CONCLUSION_SLOT: Slot = { subject: SUBJECT, predicate: PREDICATE }

function tally(
  figure: Figure,
  major: Form,
  minor: Form,
  conclusion: Form,
  onlyPopulated: boolean,
): { models: number; hits: number } {
  const [majorSlot, minorSlot] = FIGURE_SLOTS[figure]
  const first = flagsFor(major, majorSlot)
  const second = flagsFor(minor, minorSlot)
  const target = flagsFor(conclusion, CONCLUSION_SLOT)

  let models = 0
  let hits = 0
  for (let world = 0; world < WORLD_COUNT; world++) {
    if (onlyPopulated && POPULATED[world] === 0) continue
    if (first[world] === 0 || second[world] === 0) continue
    models++
    if (target[world] === 1) hits++
  }
  return { models, hits }
}

function classify(
  figure: Figure,
  major: Form,
  minor: Form,
  conclusion: Form,
  onlyPopulated: boolean,
): Verdict {
  const { models, hits } = tally(figure, major, minor, conclusion, onlyPopulated)
  if (models === 0 || hits === models) return 'folgt'
  if (hits === 0) return 'widerspricht'
  return 'folgt-nicht'
}

export function premiseModelCount(figure: Figure, major: Form, minor: Form): number {
  return tally(figure, major, minor, 'A', false).models
}

export function itemTypeOf(figure: Figure, major: Form, minor: Form, conclusion: Form): string {
  return `${major}${minor}${conclusion}-${figure}`
}

export interface Mood {
  figure: Figure
  major: Form
  minor: Form
  conclusion: Form
  itemType: string
  verdict: Verdict
  traditional: Verdict
  trap: boolean
}

function buildMoods(): Mood[] {
  const list: Mood[] = []
  for (const figure of FIGURES) {
    for (const major of FORMS) {
      for (const minor of FORMS) {
        for (const conclusion of FORMS) {
          const verdict = classify(figure, major, minor, conclusion, false)
          const traditional = classify(figure, major, minor, conclusion, true)
          list.push({
            figure,
            major,
            minor,
            conclusion,
            itemType: itemTypeOf(figure, major, minor, conclusion),
            verdict,
            traditional,
            trap: verdict !== traditional,
          })
        }
      }
    }
  }
  return list
}

const MOODS = buildMoods()
const MOOD_BY_TYPE = new Map(MOODS.map((mood) => [mood.itemType, mood]))

export function allMoods(): readonly Mood[] {
  return MOODS
}

export function moodOf(itemType: string): Mood | undefined {
  return MOOD_BY_TYPE.get(itemType)
}

export function verdictFor(figure: Figure, major: Form, minor: Form, conclusion: Form): Verdict {
  return MOOD_BY_TYPE.get(itemTypeOf(figure, major, minor, conclusion))!.verdict
}

export function verdictWithImport(
  figure: Figure,
  major: Form,
  minor: Form,
  conclusion: Form,
): Verdict {
  return MOOD_BY_TYPE.get(itemTypeOf(figure, major, minor, conclusion))!.traditional
}

export function verdictFromParams(params: JsonObject): Verdict | null {
  return MOOD_BY_TYPE.get(String(params.type))?.verdict ?? null
}

export function trapFromParams(params: JsonObject): boolean {
  return MOOD_BY_TYPE.get(String(params.type))?.trap ?? false
}

export function statementText(form: Form, subject: string, predicate: string): string {
  if (form === 'A') return `Alle ${subject} sind ${predicate}.`
  if (form === 'E') return `Keine ${subject} sind ${predicate}.`
  if (form === 'I') return `Einige ${subject} sind ${predicate}.`
  return `Einige ${subject} sind keine ${predicate}.`
}

export function renderItem(params: JsonObject): SyllogismPayload {
  const figure = Number(params.figure) as Figure
  const major = String(params.major) as Form
  const minor = String(params.minor) as Form
  const conclusion = String(params.conclusion) as Form
  const words: string[] = []
  words[SUBJECT] = TERMS[Number(params.subject)]!
  words[PREDICATE] = TERMS[Number(params.predicate)]!
  words[MIDDLE] = TERMS[Number(params.middle)]!

  const [majorSlot, minorSlot] = FIGURE_SLOTS[figure]
  return {
    premises: [
      statementText(major, words[majorSlot.subject]!, words[majorSlot.predicate]!),
      statementText(minor, words[minorSlot.subject]!, words[minorSlot.predicate]!),
    ],
    conclusion: statementText(conclusion, words[SUBJECT]!, words[PREDICATE]!),
  }
}

export const LEVEL_COUNT = 6

const LEVEL_FIGURES: readonly (readonly Figure[])[] = [
  [1],
  [1, 2],
  [1, 2, 3],
  [1, 2, 3, 4],
  [1, 2, 3, 4],
  [1, 2, 3, 4],
]

const LEVEL_FORMS: readonly (readonly Form[])[] = [
  ['A', 'E', 'I'],
  ['A', 'E', 'I'],
  ['A', 'E', 'I'],
  ['A', 'E', 'I'],
  ['A', 'E', 'I', 'O'],
  ['A', 'E', 'I', 'O'],
]

const LEVEL_TRAP_WEIGHT: readonly number[] = [1, 1, 2, 3, 6, 12]
const LEVEL_O_WEIGHT: readonly number[] = [1, 1, 1, 1, 2, 3]

type Pool = Record<Verdict, (readonly [Mood, number])[]>

function buildPools(): Pool[] {
  const pools: Pool[] = []
  for (let level = 0; level < LEVEL_COUNT; level++) {
    const pool: Pool = { folgt: [], 'folgt-nicht': [], widerspricht: [] }
    for (const figure of LEVEL_FIGURES[level]!) {
      for (const major of LEVEL_FORMS[level]!) {
        for (const minor of LEVEL_FORMS[level]!) {
          for (const conclusion of LEVEL_FORMS[level]!) {
            const mood = MOOD_BY_TYPE.get(itemTypeOf(figure, major, minor, conclusion))!
            const trapWeight = mood.trap ? LEVEL_TRAP_WEIGHT[level]! : 1
            const oWeight = major === 'O' || minor === 'O' ? LEVEL_O_WEIGHT[level]! : 1
            pool[mood.verdict].push([mood, trapWeight * oWeight] as const)
          }
        }
      }
    }
    pools.push(pool)
  }
  return pools
}

const POOLS = buildPools()

export function levelIndex(difficulty: number): number {
  const rounded = Math.round(difficulty)
  return Math.min(LEVEL_COUNT, Math.max(1, rounded)) - 1
}

export function poolFor(difficulty: number): Record<Verdict, readonly (readonly [Mood, number])[]> {
  return POOLS[levelIndex(difficulty)]!
}

export function generateSyllogism(difficulty: number, rng: Rng): SyllogismTrial {
  const pool = POOLS[levelIndex(difficulty)]!
  const reachable = VERDICTS.filter((verdict) => pool[verdict].length > 0)
  const target = rng.pick(reachable)
  const mood = rng.weighted(pool[target]!)
  const [subject, predicate, middle] = rng.sample(TERM_INDEXES, 3) as [number, number, number]

  const params: JsonObject = {
    type: mood.itemType,
    figure: mood.figure,
    major: mood.major,
    minor: mood.minor,
    conclusion: mood.conclusion,
    subject,
    predicate,
    middle,
  }

  return {
    itemType: mood.itemType,
    difficulty,
    params,
    payload: renderItem(params),
    answer: mood.verdict,
  }
}
