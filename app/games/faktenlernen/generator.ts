import type { Rng } from '~~/shared/rng'
import type { JsonObject, JsonValue, Trial } from '~~/shared/types'

export const SURNAMES = [
  'Keller',
  'Meier',
  'Baumann',
  'Brunner',
  'Steiner',
  'Frei',
  'Weber',
  'Graf',
  'Zimmermann',
  'Moser',
  'Widmer',
  'Suter',
  'Kaufmann',
  'Roth',
  'Wyss',
  'Furrer',
  'Hediger',
  'Lehmann',
  'Marti',
  'Schneider',
  'Bachmann',
  'Egger',
  'Gerber',
  'Studer',
  'Bianchi',
  'Rossi',
  'Fontana',
  'Nussbaumer',
  'Kuhn',
  'Hofer',
] as const

export const TOWNS = [
  'Chur',
  'Thun',
  'Baden',
  'Aarau',
  'Olten',
  'Wil',
  'Zug',
  'Sitten',
  'Locarno',
  'Vevey',
  'Rapperswil',
  'Frauenfeld',
  'Schaffhausen',
  'Solothurn',
  'Bellinzona',
  'Herisau',
  'Glarus',
  'Liestal',
  'Uster',
  'Interlaken',
] as const

export const PROFESSIONS = [
  'Buchhaltung',
  'Softwareentwicklung',
  'Krankenpflege',
  'Physiotherapie',
  'Zahnmedizin',
  'Rechtsberatung',
  'Steuerberatung',
  'Architektur',
  'Gartenbau',
  'Tierpflege',
  'Elektroinstallation',
  'Sanitärinstallation',
  'Schreinerei',
  'Bäckerei',
  'Metzgerei',
  'Gastronomie',
  'Hotellerie',
  'Logistik',
  'Postzustellung',
  'Feuerwehr',
  'Polizei',
  'Buchhandel',
  'Grafikdesign',
  'Fotografie',
  'Journalismus',
] as const

export const HOBBIES = [
  'Klettern',
  'Schach',
  'Töpfern',
  'Imkerei',
  'Astronomie',
  'Bogenschiessen',
  'Gitarre',
  'Malerei',
  'Origami',
  'Schwimmen',
  'Segeln',
  'Jodeln',
  'Handball',
  'Radsport',
  'Angeln',
  'Curling',
  'Vogelkunde',
  'Wandern',
  'Yoga',
  'Stricken',
  'Kochen',
  'Tanzen',
  'Theater',
  'Modellbau',
  'Briefmarkensammeln',
] as const

export const ANREDEN = ['Frau', 'Herr'] as const

export const ATTRIBUTE_KINDS = ['ort', 'beruf', 'hobby'] as const
export type AttributeKind = (typeof ATTRIBUTE_KINDS)[number]

export const QUESTION_FORMATS = ['attribut', 'person'] as const
export type QuestionFormat = (typeof QUESTION_FORMATS)[number]

export const PROFILE_COUNTS = [6, 6, 7, 7, 8] as const
export const LEARN_SECONDS = [70, 62, 55, 47, 40] as const

export const DISTRACTION_SECONDS = 20
export const DISTRACTION_ITEMS = 32
export const DISTRACTION_PROMPT = 'Ist die Zahl gerade oder ungerade?'
export const DISTRACTION_OPTIONS = ['gerade', 'ungerade'] as const

export const EXTRA_QUESTIONS = 4
export const OPTION_COUNT = 4

export interface Profile {
  anrede: string
  name: string
  ort: string
  beruf: string
  hobby: string
}

export interface QuestionSpec {
  format: QuestionFormat
  kind: AttributeKind
  profile: number
  options: number[]
  correctIndex: number
}

export interface RenderedProfile {
  person: string
  ort: string
  beruf: string
  hobby: string
}

export interface RenderedQuestion {
  text: string
  options: string[]
}

export interface FactsPayload {
  learnS: number
  distractionS: number
  distractionPrompt: string
  distractionNumbers: number[]
  distractionOptions: string[]
  profiles: RenderedProfile[]
  questions: RenderedQuestion[]
}

export type FactsTrial = Trial<FactsPayload, number[]>

export function levelFor(difficulty: number): number {
  const rounded = Math.round(difficulty)
  const clamped = Math.min(PROFILE_COUNTS.length, Math.max(1, rounded))
  return clamped - 1
}

export function profileCountFor(difficulty: number): number {
  return PROFILE_COUNTS[levelFor(difficulty)]!
}

export function learnSecondsFor(difficulty: number): number {
  return LEARN_SECONDS[levelFor(difficulty)]!
}

export function itemTypeFor(difficulty: number): string {
  return `profile${profileCountFor(difficulty)}`
}

export function personLabel(profile: Profile): string {
  return `${profile.anrede} ${profile.name}`
}

export function attributeOf(profile: Profile, kind: AttributeKind): string {
  if (kind === 'ort') return profile.ort
  if (kind === 'beruf') return profile.beruf
  return profile.hobby
}

export function questionText(format: QuestionFormat, kind: AttributeKind, subject: Profile): string {
  if (format === 'attribut') {
    const person = personLabel(subject)
    if (kind === 'ort') return `Wo wohnt ${person}?`
    if (kind === 'beruf') return `Welchen Beruf hat ${person}?`
    return `Welches Hobby hat ${person}?`
  }
  const value = attributeOf(subject, kind)
  if (kind === 'ort') return `Wer wohnt in ${value}?`
  if (kind === 'beruf') return `Wessen Beruf ist ${value}?`
  return `Wessen Hobby ist ${value}?`
}

function indices(count: number): number[] {
  const out: number[] = []
  for (let i = 0; i < count; i++) out.push(i)
  return out
}

function buildProfiles(count: number, rng: Rng): Profile[] {
  const names = rng.sample(SURNAMES, count)
  const orte = rng.sample(TOWNS, count)
  const berufe = rng.sample(PROFESSIONS, count)
  const hobbys = rng.sample(HOBBIES, count)

  const profiles: Profile[] = []
  for (let i = 0; i < count; i++) {
    profiles.push({
      anrede: rng.pick(ANREDEN),
      name: names[i]!,
      ort: orte[i]!,
      beruf: berufe[i]!,
      hobby: hobbys[i]!,
    })
  }
  return profiles
}

interface Pair {
  profile: number
  kind: AttributeKind
}

function buildPairs(count: number, rng: Rng): Pair[] {
  const order = rng.shuffle(indices(count))
  const cycle = rng.shuffle(ATTRIBUTE_KINDS)
  const covering: Pair[] = order.map((profile, position) => ({
    profile,
    kind: cycle[position % cycle.length]!,
  }))

  const used = new Set(covering.map((pair) => `${pair.profile}:${pair.kind}`))
  const rest: Pair[] = []
  for (const profile of indices(count)) {
    for (const kind of ATTRIBUTE_KINDS) {
      if (!used.has(`${profile}:${kind}`)) rest.push({ profile, kind })
    }
  }

  return rng.shuffle([...covering, ...rng.sample(rest, EXTRA_QUESTIONS)])
}

function buildFormats(total: number, rng: Rng): QuestionFormat[] {
  const formats: QuestionFormat[] = []
  for (let i = 0; i < total; i++) formats.push(i % 2 === 0 ? 'attribut' : 'person')
  return rng.shuffle(formats)
}

function buildQuestions(count: number, rng: Rng): QuestionSpec[] {
  const pairs = buildPairs(count, rng)
  const formats = buildFormats(pairs.length, rng)

  return pairs.map((pair, position) => {
    const pool = indices(count).filter((entry) => entry !== pair.profile)
    const others = rng.sample(pool, OPTION_COUNT - 1)
    const options = rng.shuffle([pair.profile, ...others])
    return {
      format: formats[position]!,
      kind: pair.kind,
      profile: pair.profile,
      options,
      correctIndex: options.indexOf(pair.profile),
    }
  })
}

function renderProfile(profile: Profile): RenderedProfile {
  return {
    person: personLabel(profile),
    ort: profile.ort,
    beruf: profile.beruf,
    hobby: profile.hobby,
  }
}

function renderQuestion(spec: QuestionSpec, profiles: Profile[]): RenderedQuestion {
  return {
    text: questionText(spec.format, spec.kind, profiles[spec.profile]!),
    options: spec.options.map((entry) =>
      spec.format === 'person' ? personLabel(profiles[entry]!) : attributeOf(profiles[entry]!, spec.kind),
    ),
  }
}

function profileToJson(profile: Profile): JsonObject {
  return {
    anrede: profile.anrede,
    name: profile.name,
    ort: profile.ort,
    beruf: profile.beruf,
    hobby: profile.hobby,
  }
}

function questionToJson(spec: QuestionSpec): JsonObject {
  return {
    format: spec.format,
    kind: spec.kind,
    profile: spec.profile,
    options: [...spec.options],
    correctIndex: spec.correctIndex,
  }
}

export function correctIndicesFromParams(params: JsonObject): number[] {
  const raw = params.questions
  if (!Array.isArray(raw)) return []
  const out: number[] = []
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue
    const value = (entry as { [key: string]: JsonValue }).correctIndex
    const numeric = typeof value === 'number' ? value : Number(value)
    out.push(Number.isInteger(numeric) ? numeric : -1)
  }
  return out
}

export function responseIndices(value: unknown, length: number): number[] {
  const out: number[] = []
  const source = Array.isArray(value) ? value : []
  for (let i = 0; i < length; i++) {
    const entry = source[i]
    const numeric = typeof entry === 'number' ? entry : Number(entry)
    out.push(Number.isInteger(numeric) ? numeric : -1)
  }
  return out
}

export function tallyAnswers(params: JsonObject, response: unknown): { korrekt: number; gesamt: number } {
  const expected = correctIndicesFromParams(params)
  const given = responseIndices(response, expected.length)
  let korrekt = 0
  for (let i = 0; i < expected.length; i++) {
    if (expected[i]! >= 0 && expected[i] === given[i]) korrekt++
  }
  return { korrekt, gesamt: expected.length }
}

export function learnMsFromParams(params: JsonObject): number {
  const value = Number(params.learnMs)
  return Number.isFinite(value) && value > 0 ? value : 0
}

export function profileCountFromParams(params: JsonObject): number {
  const value = Number(params.profileCount)
  return Number.isFinite(value) && value > 0 ? value : 0
}

export function generateFacts(difficulty: number, rng: Rng): FactsTrial {
  const count = profileCountFor(difficulty)
  const learnS = learnSecondsFor(difficulty)

  const profiles = buildProfiles(count, rng)
  const specs = buildQuestions(count, rng)

  const distractionNumbers: number[] = []
  for (let i = 0; i < DISTRACTION_ITEMS; i++) distractionNumbers.push(rng.int(12, 99))

  const itemType = itemTypeFor(difficulty)

  return {
    itemType,
    difficulty,
    params: {
      type: itemType,
      profileCount: count,
      learnMs: learnS * 1000,
      distractionMs: DISTRACTION_SECONDS * 1000,
      profiles: profiles.map(profileToJson),
      questions: specs.map(questionToJson),
      distraction: [...distractionNumbers],
    },
    payload: {
      learnS,
      distractionS: DISTRACTION_SECONDS,
      distractionPrompt: DISTRACTION_PROMPT,
      distractionNumbers,
      distractionOptions: [...DISTRACTION_OPTIONS],
      profiles: profiles.map(renderProfile),
      questions: specs.map((spec) => renderQuestion(spec, profiles)),
    },
    answer: specs.map((spec) => spec.correctIndex),
  }
}
