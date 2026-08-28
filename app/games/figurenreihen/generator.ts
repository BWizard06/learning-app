import type { Rng } from '~~/shared/rng'
import type { ChoiceOption, JsonObject, Trial } from '~~/shared/types'

export const SHAPES = ['fahne', 'haken', 'pfeil', 'blitz'] as const
export type ShapeName = (typeof SHAPES)[number]

export const FILLS = ['leer', 'halb', 'voll'] as const
export type FillName = (typeof FILLS)[number]

export const FEATURE_KEYS = ['rotation', 'spiegelung', 'anzahl', 'fuellung', 'position'] as const
export type FeatureKey = (typeof FEATURE_KEYS)[number]

export type Figure = Record<FeatureKey, number>

export const DOMAIN_SIZE: Record<FeatureKey, number> = {
  rotation: 8,
  spiegelung: 2,
  anzahl: 6,
  fuellung: 3,
  position: 8,
}

export const WRAPS: Record<FeatureKey, boolean> = {
  rotation: true,
  spiegelung: true,
  anzahl: false,
  fuellung: true,
  position: true,
}

export const MAX_MAGNITUDE: Record<FeatureKey, number> = {
  rotation: 3,
  spiegelung: 1,
  anzahl: 1,
  fuellung: 2,
  position: 3,
}

export const SHOWN_LENGTHS = [4, 5] as const

export const DISTRACTOR_COUNT = 5
export const OPTION_COUNT = DISTRACTOR_COUNT + 1
export const ROTATION_STEP_DEG = 45

export const RULE_SOURCES = ['zu-weit', 'zu-kurz', 'gegenrichtung', 'startwert'] as const
export const CONSTANT_SOURCE = 'falsches-merkmal'
export const SOLUTION_SOURCE = 'loesung'

const QUESTION = 'Welche Figur setzt die Reihe fort?'

export const SHAPE_POINTS: Record<ShapeName, readonly (readonly [number, number])[]> = {
  fahne: [
    [-0.3, 1],
    [-0.3, -1],
    [0.9, -0.55],
    [-0.05, -0.15],
    [-0.05, 1],
  ],
  haken: [
    [-0.58, -0.74],
    [-0.16, -0.74],
    [-0.16, 0.37],
    [0.7, 0.37],
    [0.7, 0.78],
    [-0.58, 0.78],
  ],
  pfeil: [
    [-0.81, -0.27],
    [0.09, -0.27],
    [0.09, -0.72],
    [0.85, 0.04],
    [0.09, 0.81],
    [0.09, 0.31],
    [-0.4, 0.31],
    [-0.4, 0.67],
    [-0.81, 0.67],
  ],
  blitz: [
    [-0.13, -0.82],
    [0.65, -0.82],
    [0.13, -0.17],
    [0.69, -0.17],
    [-0.26, 0.82],
    [0, 0.04],
    [-0.56, 0.04],
  ],
}

const CLUSTERS: readonly (readonly (readonly [number, number])[])[] = [
  [[50, 50]],
  [
    [50, 28],
    [50, 72],
  ],
  [
    [50, 28],
    [69.05, 61],
    [30.95, 61],
  ],
  [
    [50, 28],
    [72, 50],
    [50, 72],
    [28, 50],
  ],
  [
    [50, 28],
    [70.92, 43.2],
    [62.93, 67.8],
    [37.07, 67.8],
    [29.08, 43.2],
  ],
  [
    [50, 28],
    [69.05, 39],
    [69.05, 61],
    [50, 72],
    [30.95, 61],
    [30.95, 39],
  ],
]

const CLUSTER_RADII: readonly number[] = [19, 13, 13, 12, 10, 9]

const MARKERS: readonly (readonly [number, number])[] = [
  [50, 8],
  [79.7, 20.3],
  [92, 50],
  [79.7, 79.7],
  [50, 92],
  [20.3, 79.7],
  [8, 50],
  [20.3, 20.3],
]

const POSITION_LABELS: readonly string[] = [
  'oben',
  'rechts oben',
  'rechts',
  'rechts unten',
  'unten',
  'links unten',
  'links',
  'links oben',
]

const FILL_ATTRS: Record<FillName, string> = {
  leer: 'fill="none"',
  halb: 'fill="currentColor" fill-opacity="0.38"',
  voll: 'fill="currentColor"',
}

const FILL_LABELS: Record<FillName, string> = {
  leer: 'offen',
  halb: 'halb gefüllt',
  voll: 'gefüllt',
}

const SHAPE_LABELS: Record<ShapeName, readonly [string, string]> = {
  fahne: ['Fahne', 'Fahnen'],
  haken: ['Haken', 'Haken'],
  pfeil: ['Pfeil', 'Pfeile'],
  blitz: ['Blitz', 'Blitze'],
}

export function mod(value: number, size: number): number {
  return ((value % size) + size) % size
}

export function advance(feature: FeatureKey, value: number, step: number): number {
  return WRAPS[feature] ? mod(value + step, DOMAIN_SIZE[feature]) : value + step
}

export function inDomain(feature: FeatureKey, value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < DOMAIN_SIZE[feature]
}

function fmt(value: number): string {
  return String(Math.round(value * 100) / 100)
}

function strokeFor(radius: number): number {
  if (radius >= 15) return 3
  if (radius >= 12) return 2.5
  return 2
}

function pointsFor(shape: ShapeName, radius: number): string {
  return SHAPE_POINTS[shape].map(([x, y]) => `${fmt(x * radius)},${fmt(y * radius)}`).join(' ')
}

export function describeFigure(shape: ShapeName, figure: Figure): string {
  const count = figure.anzahl + 1
  const [one, many] = SHAPE_LABELS[shape]
  const parts = [
    `${count} ${count === 1 ? one : many}`,
    FILL_LABELS[FILLS[figure.fuellung]!],
  ]
  if (figure.rotation !== 0) parts.push(`${figure.rotation * ROTATION_STEP_DEG} Grad gedreht`)
  if (figure.spiegelung === 1) parts.push('gespiegelt')
  parts.push(`Punkt ${POSITION_LABELS[figure.position]!}`)
  return parts.join(', ')
}

export function figureToSvg(shape: ShapeName, figure: Figure): string {
  const radius = CLUSTER_RADII[figure.anzahl]!
  const points = pointsFor(shape, radius)
  const scaleX = figure.spiegelung === 1 ? -1 : 1
  const degrees = figure.rotation * ROTATION_STEP_DEG
  const body = CLUSTERS[figure.anzahl]!
    .map(
      ([x, y]) =>
        `<g transform="translate(${fmt(x)} ${fmt(y)}) rotate(${degrees}) scale(${scaleX} 1)"><polygon points="${points}"/></g>`,
    )
    .join('')
  const [markerX, markerY] = MARKERS[figure.position]!
  return [
    '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img"',
    ' stroke="currentColor" stroke-linejoin="round">',
    `<title>${describeFigure(shape, figure)}</title>`,
    '<rect x="3" y="3" width="94" height="94" rx="9" fill="none" stroke-opacity="0.22" stroke-width="1.5"/>',
    `<g ${FILL_ATTRS[FILLS[figure.fuellung]!]} stroke-width="${strokeFor(radius)}">${body}</g>`,
    `<circle cx="${fmt(markerX!)}" cy="${fmt(markerY!)}" r="4" fill="currentColor" stroke="none"/>`,
    '</svg>',
  ].join('')
}

export interface Rule {
  feature: FeatureKey
  step: number
}

export interface Config {
  shape: ShapeName
  shownLen: number
  rules: Rule[]
  start: Figure
}

export interface Misreading {
  feature: FeatureKey
  source: string
  value: number
}

export interface SeriesPayload {
  question: string
  figures: string[]
}

export type SeriesTrial = Trial<SeriesPayload, number>

export function ruleCountFor(difficulty: number, rng: Rng): number {
  const level = Math.round(difficulty)
  if (level <= 2) return 1
  if (level === 3) return rng.bool(0.5) ? 1 : 2
  if (level <= 5) return 2
  if (level === 6) return rng.bool(0.5) ? 2 : 3
  return 3
}

export function maxStepFor(difficulty: number): number {
  const level = Math.round(difficulty)
  if (level <= 2) return 1
  if (level <= 5) return 2
  return 3
}

function stepFor(rng: Rng, feature: FeatureKey, maxStep: number): number {
  const magnitude = rng.int(1, Math.min(maxStep, MAX_MAGNITUDE[feature]))
  if (feature === 'spiegelung') return 1
  return magnitude * rng.sign()
}

function startValue(rng: Rng, feature: FeatureKey, step: number | undefined, shownLen: number): number {
  const size = DOMAIN_SIZE[feature]
  if (step === undefined || WRAPS[feature]) return rng.int(0, size - 1)
  const span = Math.abs(step) * shownLen
  const room = Math.max(0, size - 1 - span)
  return step > 0 ? rng.int(0, room) : rng.int(size - 1 - room, size - 1)
}

export function buildConfig(difficulty: number, rng: Rng): Config {
  const ruleCount = ruleCountFor(difficulty, rng)
  const maxStep = maxStepFor(difficulty)
  const shownLen = rng.pick(SHOWN_LENGTHS)
  const shape = rng.pick(SHAPES)
  const rules = rng
    .sample(FEATURE_KEYS, ruleCount)
    .map((feature) => ({ feature, step: stepFor(rng, feature, maxStep) }))
  const steps = new Map(rules.map((rule) => [rule.feature, rule.step]))

  const start = {} as Figure
  for (const feature of FEATURE_KEYS) {
    start[feature] = startValue(rng, feature, steps.get(feature), shownLen)
  }
  return { shape, shownLen, rules, start }
}

export const FALLBACK_CONFIG: Config = {
  shape: 'fahne',
  shownLen: 4,
  rules: [
    { feature: 'rotation', step: 1 },
    { feature: 'fuellung', step: 1 },
  ],
  start: { rotation: 0, spiegelung: 0, anzahl: 2, fuellung: 0, position: 0 },
}

export function buildFigures(config: Config): Figure[] {
  const steps = new Map(config.rules.map((rule) => [rule.feature, rule.step]))
  const figures: Figure[] = [{ ...config.start }]
  for (let index = 1; index <= config.shownLen; index++) {
    const previous = figures[index - 1]!
    const next = {} as Figure
    for (const feature of FEATURE_KEYS) {
      const step = steps.get(feature)
      next[feature] = step === undefined ? previous[feature] : advance(feature, previous[feature], step)
    }
    figures.push(next)
  }
  return figures
}

export function ruleMisreadings(rule: Rule, figures: Figure[]): Misreading[] {
  const { feature, step } = rule
  const answer = figures[figures.length - 1]![feature]
  const last = figures[figures.length - 2]![feature]
  const first = figures[0]![feature]
  const raw: Misreading[] = [
    { feature, source: 'zu-weit', value: advance(feature, answer, step) },
    { feature, source: 'zu-kurz', value: last },
    { feature, source: 'gegenrichtung', value: advance(feature, last, -step) },
    { feature, source: 'startwert', value: first },
  ]

  const seen = new Set<number>()
  const out: Misreading[] = []
  for (const entry of raw) {
    if (entry.value === answer) continue
    if (!inDomain(feature, entry.value)) continue
    if (seen.has(entry.value)) continue
    seen.add(entry.value)
    out.push(entry)
  }
  return out
}

export function constantMisreading(feature: FeatureKey, value: number, direction: number): Misreading {
  if (WRAPS[feature]) {
    return { feature, source: CONSTANT_SOURCE, value: mod(value + direction, DOMAIN_SIZE[feature]) }
  }
  const forward = value + direction
  const usable = inDomain(feature, forward)
  return { feature, source: CONSTANT_SOURCE, value: usable ? forward : value - direction }
}

export function buildPool(config: Config, figures: Figure[]): Misreading[] {
  const active = new Set(config.rules.map((rule) => rule.feature))
  const direction = config.rules[0]!.step >= 0 ? 1 : -1
  const answer = figures[figures.length - 1]!
  const pool: Misreading[] = []
  for (const rule of config.rules) pool.push(...ruleMisreadings(rule, figures))
  for (const feature of FEATURE_KEYS) {
    if (active.has(feature)) continue
    pool.push(constantMisreading(feature, answer[feature], direction))
  }
  return pool
}

function chooseDistractors(pool: Misreading[], activeCount: number, rng: Rng): Misreading[] {
  const order: FeatureKey[] = []
  const grouped = new Map<FeatureKey, Misreading[]>()
  for (const entry of pool) {
    const bucket = grouped.get(entry.feature)
    if (bucket) {
      bucket.push(entry)
    } else {
      grouped.set(entry.feature, [entry])
      order.push(entry.feature)
    }
  }

  const chosen: Misreading[] = []
  const groups = [order.slice(0, activeCount), order.slice(activeCount)]
  for (const group of groups) {
    const queues = rng.shuffle(group).map((feature) => rng.shuffle(grouped.get(feature)!))
    for (let round = 0; chosen.length < DISTRACTOR_COUNT; round++) {
      let added = false
      for (const queue of queues) {
        if (queue.length <= round) continue
        chosen.push(queue[round]!)
        added = true
        if (chosen.length === DISTRACTOR_COUNT) break
      }
      if (!added) break
    }
  }
  return chosen
}

export function itemTypeFor(rules: Rule[]): string {
  const names = rules.map((rule) => rule.feature as string).sort()
  return `reihe${rules.length}-${names.join('+')}`
}

function withFeature(figure: Figure, feature: FeatureKey, value: number): Figure {
  const next = {} as Figure
  for (const key of FEATURE_KEYS) next[key] = key === feature ? value : figure[key]
  return next
}

function figureToJson(figure: Figure): JsonObject {
  return {
    rotation: figure.rotation,
    spiegelung: figure.spiegelung,
    anzahl: figure.anzahl,
    fuellung: figure.fuellung,
    position: figure.position,
  }
}

function buildTrial(
  config: Config,
  figures: Figure[],
  pool: Misreading[],
  difficulty: number,
  rng: Rng,
): SeriesTrial {
  const answer = figures[figures.length - 1]!
  const distractors = chooseDistractors(pool, config.rules.length, rng)

  const entries = [
    { figure: answer, feature: 'keines', source: SOLUTION_SOURCE },
    ...distractors.map((entry) => ({
      figure: withFeature(answer, entry.feature, entry.value),
      feature: entry.feature as string,
      source: entry.source,
    })),
  ]

  const shuffled = rng.shuffle(entries)
  const correctIndex = shuffled.findIndex((entry) => entry.source === SOLUTION_SOURCE)

  const options: ChoiceOption[] = shuffled.map((entry, index) => ({
    id: `figur-${index}`,
    label: describeFigure(config.shape, entry.figure),
    svg: figureToSvg(config.shape, entry.figure),
  }))

  const itemType = itemTypeFor(config.rules)

  return {
    itemType,
    difficulty,
    params: {
      type: itemType,
      shape: config.shape,
      shownLen: config.shownLen,
      rules: config.rules.map((rule) => ({ feature: rule.feature as string, step: rule.step })),
      figures: figures.map(figureToJson),
      options: shuffled.map((entry) => figureToJson(entry.figure)),
      sources: shuffled.map((entry) => ({ feature: entry.feature, source: entry.source })),
      correctIndex,
    },
    payload: {
      question: QUESTION,
      figures: figures
        .slice(0, config.shownLen)
        .map((figure) => figureToSvg(config.shape, figure)),
    },
    answer: correctIndex,
    options,
    correctIndex,
  }
}

export function generateSeries(difficulty: number, rng: Rng): SeriesTrial {
  for (let attempt = 0; attempt < 16; attempt++) {
    const config = buildConfig(difficulty, rng)
    const figures = buildFigures(config)
    const pool = buildPool(config, figures)
    if (pool.length >= DISTRACTOR_COUNT) return buildTrial(config, figures, pool, difficulty, rng)
  }
  const figures = buildFigures(FALLBACK_CONFIG)
  return buildTrial(FALLBACK_CONFIG, figures, buildPool(FALLBACK_CONFIG, figures), difficulty, rng)
}
