import type { Rng } from '~~/shared/rng'
import type { ChoiceOption, JsonObject, Trial } from '~~/shared/types'

export const SHAPES = ['kreis', 'quadrat', 'dreieck', 'raute', 'sechseck'] as const
export const COUNTS = [1, 2, 3, 4, 5] as const
export const FILLS = ['leer', 'halb', 'voll'] as const
export const ROTATIONS = [0, 45, 90, 135] as const
export const SIZES = ['klein', 'mittel', 'gross'] as const

export type ShapeName = (typeof SHAPES)[number]
export type FillName = (typeof FILLS)[number]
export type SizeName = (typeof SIZES)[number]

export type CellFeatures = {
  shape: ShapeName
  count: number
  fill: FillName
  rotation: number
  size: SizeName
}

export const FEATURE_KEYS = ['shape', 'count', 'fill', 'rotation', 'size'] as const
export type FeatureKey = (typeof FEATURE_KEYS)[number]

export const DOMAINS: Record<FeatureKey, readonly (string | number)[]> = {
  shape: SHAPES,
  count: COUNTS,
  fill: FILLS,
  rotation: ROTATIONS,
  size: SIZES,
}

const DOMAIN_SIZE: Record<FeatureKey, number> = {
  shape: SHAPES.length,
  count: COUNTS.length,
  fill: FILLS.length,
  rotation: ROTATIONS.length,
  size: SIZES.length,
}

const WRAPS: Record<FeatureKey, boolean> = {
  shape: false,
  count: false,
  fill: false,
  rotation: true,
  size: false,
}

export type RuleKind = 'konstant' | 'konstant-in-zeile' | 'progression' | 'verteilung'

export type Rule =
  | { kind: 'konstant'; value: number }
  | { kind: 'konstant-in-zeile'; rows: number[] }
  | { kind: 'progression'; start: number; colStep: number; rowShift: number; wrap: boolean }
  | { kind: 'verteilung'; values: number[]; rowShift: number }

export type Config = Record<FeatureKey, Rule>

export type MatrixPayload = {
  question: string
  cells: string[]
}

export type MatrixTrial = Trial<MatrixPayload, number>

export const DISTRACTOR_COUNT = 5
export const OPTION_COUNT = DISTRACTOR_COUNT + 1

const QUESTION = 'Welche Figur vervollständigt die Matrix?'

const ROTATION_SHAPES: ShapeName[] = ['dreieck', 'sechseck']

const ALLOWED_RULES: Record<FeatureKey, RuleKind[]> = {
  shape: ['konstant-in-zeile', 'verteilung'],
  count: ['konstant-in-zeile', 'verteilung', 'progression'],
  fill: ['konstant-in-zeile', 'verteilung'],
  rotation: ['konstant-in-zeile', 'verteilung', 'progression'],
  size: ['konstant-in-zeile', 'verteilung'],
}

const POSITIONS: readonly (readonly (readonly [number, number])[])[] = [
  [[50, 50]],
  [[28, 50], [72, 50]],
  [[50, 27], [29, 68], [71, 68]],
  [[29, 29], [71, 29], [29, 71], [71, 71]],
  [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
]

const RADII: Record<SizeName, readonly number[]> = {
  klein: [18, 11, 10, 10, 8],
  mittel: [25, 15, 14, 13, 10],
  gross: [32, 19, 17, 17, 13],
}

const FILL_ATTRS: Record<FillName, string> = {
  leer: 'fill="none"',
  halb: 'fill="currentColor" fill-opacity="0.4"',
  voll: 'fill="currentColor"',
}

const SHAPE_LABELS: Record<ShapeName, readonly [string, string]> = {
  kreis: ['Kreis', 'Kreise'],
  quadrat: ['Quadrat', 'Quadrate'],
  dreieck: ['Dreieck', 'Dreiecke'],
  raute: ['Raute', 'Rauten'],
  sechseck: ['Sechseck', 'Sechsecke'],
}

const FILL_LABELS: Record<FillName, string> = {
  leer: 'offen',
  halb: 'halb gefüllt',
  voll: 'gefüllt',
}

const SIZE_LABELS: Record<SizeName, string> = {
  klein: 'klein',
  mittel: 'mittel',
  gross: 'gross',
}

function mod(value: number, size: number): number {
  return ((value % size) + size) % size
}

function fmt(value: number): string {
  return String(Math.round(value * 100) / 100)
}

function polygon(radius: number, sides: number, startAngle: number, squash: number): string {
  const points: string[] = []
  for (let i = 0; i < sides; i++) {
    const angle = ((startAngle + (360 / sides) * i) * Math.PI) / 180
    points.push(`${fmt(Math.cos(angle) * radius * squash)},${fmt(Math.sin(angle) * radius)}`)
  }
  return points.join(' ')
}

function shapeMarkup(shape: ShapeName, radius: number): string {
  switch (shape) {
    case 'kreis':
      return `<circle cx="0" cy="0" r="${fmt(radius)}"/>`
    case 'quadrat': {
      const half = radius * 0.86
      return `<rect x="${fmt(-half)}" y="${fmt(-half)}" width="${fmt(half * 2)}" height="${fmt(half * 2)}"/>`
    }
    case 'dreieck':
      return `<polygon points="${polygon(radius, 3, -90, 1)}"/>`
    case 'raute':
      return `<polygon points="${polygon(radius, 4, -90, 0.62)}"/>`
    case 'sechseck':
      return `<polygon points="${polygon(radius, 6, -90, 1)}"/>`
  }
}

function strokeFor(radius: number): number {
  if (radius >= 18) return 3
  if (radius >= 12) return 2.5
  return 2
}

export function describeCell(features: CellFeatures): string {
  const [one, many] = SHAPE_LABELS[features.shape]
  const parts = [
    `${features.count} ${features.count === 1 ? one : many}`,
    FILL_LABELS[features.fill],
    SIZE_LABELS[features.size],
  ]
  if (features.rotation !== 0) parts.push(`${features.rotation} Grad gedreht`)
  return parts.join(', ')
}

export function cellToSvg(features: CellFeatures): string {
  const positions = POSITIONS[features.count - 1]!
  const radius = RADII[features.size]![features.count - 1]!
  const body = positions
    .map(
      ([x, y]) =>
        `<g transform="translate(${fmt(x)} ${fmt(y)}) rotate(${features.rotation})">${shapeMarkup(features.shape, radius)}</g>`,
    )
    .join('')
  return [
    '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img"',
    ` ${FILL_ATTRS[features.fill]} stroke="currentColor" stroke-width="${strokeFor(radius)}"`,
    ' stroke-linejoin="round">',
    `<title>${describeCell(features)}</title>`,
    body,
    '</svg>',
  ].join('')
}

export function valueAt(rule: Rule, row: number, col: number, size: number): number {
  switch (rule.kind) {
    case 'konstant':
      return rule.value
    case 'konstant-in-zeile':
      return rule.rows[row]!
    case 'progression': {
      const raw = rule.start + rule.rowShift * row + rule.colStep * col
      return rule.wrap ? mod(raw, size) : raw
    }
    case 'verteilung':
      return rule.values[mod(row * rule.rowShift + col, 3)]!
  }
}

export interface Misreading {
  source: string
  value: number
}

export function misreadings(rule: Rule, size: number): Misreading[] {
  const correct = valueAt(rule, 2, 2, size)
  const raw: Misreading[] = [
    { source: 'links', value: valueAt(rule, 2, 1, size) },
    { source: 'oben', value: valueAt(rule, 1, 2, size) },
    { source: 'zeilenanfang', value: valueAt(rule, 2, 0, size) },
    { source: 'spaltenanfang', value: valueAt(rule, 0, 2, size) },
  ]
  if (rule.kind === 'progression') {
    raw.push({ source: 'weiter', value: valueAt(rule, 2, 3, size) })
  }

  const seen = new Set<number>()
  const out: Misreading[] = []
  for (const entry of raw) {
    if (entry.value === correct) continue
    if (!Number.isInteger(entry.value) || entry.value < 0 || entry.value >= size) continue
    if (seen.has(entry.value)) continue
    seen.add(entry.value)
    out.push(entry)
  }
  return out
}

function indices(size: number): number[] {
  const out: number[] = []
  for (let i = 0; i < size; i++) out.push(i)
  return out
}

function progressionOptions(feature: FeatureKey): Rule[] {
  const size = DOMAIN_SIZE[feature]
  const wrap = WRAPS[feature]
  const out: Rule[] = []
  for (const colStep of [1, -1]) {
    for (const rowShift of [-1, 0, 1]) {
      for (let start = 0; start < size; start++) {
        const rule: Rule = { kind: 'progression', start, colStep, rowShift, wrap }
        let usable = true
        for (let row = 0; row < 3 && usable; row++) {
          const inRow = new Set<number>()
          for (let col = 0; col < 3; col++) {
            const value = valueAt(rule, row, col, size)
            if (value < 0 || value >= size) usable = false
            inRow.add(value)
          }
          if (inRow.size !== 3) usable = false
        }
        if (usable) out.push(rule)
      }
    }
  }
  return out
}

function pickProgression(rng: Rng, feature: FeatureKey, minBudget: number): Rule {
  const all = progressionOptions(feature)
  const rich = all.filter((rule) => misreadings(rule, DOMAIN_SIZE[feature]).length >= minBudget)
  return rng.pick(rich.length > 0 ? rich : all)
}

function pickRule(rng: Rng, feature: FeatureKey, allowVerteilung: boolean): Rule {
  const kinds = ALLOWED_RULES[feature].filter((kind) => kind !== 'verteilung' || allowVerteilung)
  return buildRule(rng, feature, rng.pick(kinds))
}

function buildRule(rng: Rng, feature: FeatureKey, kind: RuleKind): Rule {
  const size = DOMAIN_SIZE[feature]
  if (kind === 'progression') return pickProgression(rng, feature, 2)
  if (kind === 'verteilung') {
    return { kind: 'verteilung', values: rng.sample(indices(size), 3), rowShift: rng.pick([1, 2]) }
  }
  if (kind === 'konstant-in-zeile') {
    return { kind: 'konstant-in-zeile', rows: rng.sample(indices(size), 3) }
  }
  return { kind: 'konstant', value: rng.int(0, size - 1) }
}

function constantRule(rng: Rng, feature: FeatureKey, useRotation: boolean): Rule {
  if (feature === 'rotation') return { kind: 'konstant', value: 0 }
  if (feature === 'count') return { kind: 'konstant', value: rng.int(0, 2) }
  if (feature === 'shape' && useRotation) {
    return { kind: 'konstant', value: SHAPES.indexOf(rng.pick(ROTATION_SHAPES)) }
  }
  return { kind: 'konstant', value: rng.int(0, DOMAIN_SIZE[feature] - 1) }
}

function ruleCountFor(difficulty: number, rng: Rng): number {
  if (difficulty <= 3) return 2
  if (difficulty <= 6) return rng.bool(0.5) ? 2 : 3
  return 3
}

export function buildConfig(difficulty: number, rng: Rng): Config {
  const ruleCount = ruleCountFor(difficulty, rng)
  const allowVerteilung = difficulty >= 4
  const useRotation = rng.bool(0.35)

  const carriers = new Map<FeatureKey, Rule>()

  if (ruleCount === 2) {
    const driver: FeatureKey = useRotation ? 'rotation' : 'count'
    const partners: FeatureKey[] = useRotation ? ['count', 'fill', 'size'] : ['shape', 'fill', 'size']
    const partner = rng.pick(partners)
    carriers.set(driver, pickProgression(rng, driver, 3))
    carriers.set(partner, pickRule(rng, partner, allowVerteilung))
  } else {
    const pool: FeatureKey[] = useRotation ? ['count', 'fill', 'size'] : ['shape', 'count', 'fill', 'size']
    const picked = useRotation
      ? (['rotation', ...rng.sample(pool, 2)] as FeatureKey[])
      : rng.sample(pool, 3)
    for (const feature of picked) {
      carriers.set(feature, pickRule(rng, feature, allowVerteilung))
    }
  }

  const config = {} as Config
  for (const feature of FEATURE_KEYS) {
    config[feature] = carriers.get(feature) ?? constantRule(rng, feature, useRotation)
  }
  return config
}

export const FALLBACK_CONFIG: Config = {
  shape: { kind: 'verteilung', values: [0, 1, 2], rowShift: 1 },
  count: { kind: 'konstant-in-zeile', rows: [0, 1, 2] },
  fill: { kind: 'verteilung', values: [0, 1, 2], rowShift: 2 },
  rotation: { kind: 'konstant', value: 0 },
  size: { kind: 'konstant', value: 1 },
}

type CellIndices = Record<FeatureKey, number>

function cellAt(config: Config, row: number, col: number): CellIndices {
  const cell = {} as CellIndices
  for (const feature of FEATURE_KEYS) {
    cell[feature] = valueAt(config[feature], row, col, DOMAIN_SIZE[feature])
  }
  return cell
}

function withFeature(cell: CellIndices, feature: FeatureKey, value: number): CellIndices {
  const next = {} as CellIndices
  for (const key of FEATURE_KEYS) next[key] = key === feature ? value : cell[key]
  return next
}

function resolve(cell: CellIndices): CellFeatures {
  return {
    shape: SHAPES[cell.shape]!,
    count: COUNTS[cell.count]!,
    fill: FILLS[cell.fill]!,
    rotation: ROTATIONS[cell.rotation]!,
    size: SIZES[cell.size]!,
  }
}

export interface Candidate {
  feature: FeatureKey
  value: number
  source: string
  cell: CellFeatures
  svg: string
}

export function buildPool(config: Config): Candidate[] {
  const answer = cellAt(config, 2, 2)
  const taken = new Set<string>([cellToSvg(resolve(answer))])
  const out: Candidate[] = []
  for (const feature of FEATURE_KEYS) {
    for (const entry of misreadings(config[feature], DOMAIN_SIZE[feature])) {
      const cell = resolve(withFeature(answer, feature, entry.value))
      const svg = cellToSvg(cell)
      if (taken.has(svg)) continue
      taken.add(svg)
      out.push({ feature, value: entry.value, source: entry.source, cell, svg })
    }
  }
  return out
}

function chooseDistractors(pool: Candidate[], rng: Rng): Candidate[] {
  const grouped = new Map<FeatureKey, Candidate[]>()
  for (const candidate of pool) {
    const bucket = grouped.get(candidate.feature)
    if (bucket) bucket.push(candidate)
    else grouped.set(candidate.feature, [candidate])
  }

  const queues = rng
    .shuffle([...grouped.keys()])
    .map((feature) => rng.shuffle(grouped.get(feature)!))

  const chosen: Candidate[] = []
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
  return chosen
}

function ruleToJson(feature: FeatureKey, rule: Rule): JsonObject {
  switch (rule.kind) {
    case 'konstant':
      return { feature, kind: rule.kind, value: rule.value }
    case 'konstant-in-zeile':
      return { feature, kind: rule.kind, rows: [...rule.rows] }
    case 'progression':
      return {
        feature,
        kind: rule.kind,
        start: rule.start,
        colStep: rule.colStep,
        rowShift: rule.rowShift,
        wrap: rule.wrap,
      }
    case 'verteilung':
      return { feature, kind: rule.kind, values: [...rule.values], rowShift: rule.rowShift }
  }
}

function cellToJson(cell: CellFeatures): JsonObject {
  return {
    shape: cell.shape,
    count: cell.count,
    fill: cell.fill,
    rotation: cell.rotation,
    size: cell.size,
  }
}

export function itemTypeFor(config: Config): string {
  const carriers = FEATURE_KEYS.filter((feature) => config[feature].kind !== 'konstant')
  const kinds = [...new Set(carriers.map((feature) => config[feature].kind))].sort()
  return `regeln${carriers.length}-${kinds.join('+')}`
}

function buildTrial(config: Config, difficulty: number, pool: Candidate[], rng: Rng): MatrixTrial {
  const distractors = chooseDistractors(pool, rng)
  const answerCell = resolve(cellAt(config, 2, 2))

  const entries = [
    { cell: answerCell, svg: cellToSvg(answerCell), feature: 'keines', source: 'loesung' },
    ...distractors.map((candidate) => ({
      cell: candidate.cell,
      svg: candidate.svg,
      feature: candidate.feature as string,
      source: candidate.source,
    })),
  ]

  const shuffled = rng.shuffle(entries)
  const correctIndex = shuffled.findIndex((entry) => entry.source === 'loesung')

  const options: ChoiceOption[] = shuffled.map((entry, index) => ({
    id: `feld-${index}`,
    label: describeCell(entry.cell),
    svg: entry.svg,
  }))

  const matrix: CellFeatures[] = []
  const cells: string[] = []
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const cell = resolve(cellAt(config, row, col))
      matrix.push(cell)
      if (row !== 2 || col !== 2) cells.push(cellToSvg(cell))
    }
  }

  const itemType = itemTypeFor(config)

  return {
    itemType,
    difficulty,
    params: {
      type: itemType,
      rules: FEATURE_KEYS.map((feature) => ruleToJson(feature, config[feature])),
      matrix: matrix.map(cellToJson),
      options: shuffled.map((entry) => cellToJson(entry.cell)),
      sources: shuffled.map((entry) => ({ feature: entry.feature, source: entry.source })),
      correctIndex,
    },
    payload: { question: QUESTION, cells },
    answer: correctIndex,
    options,
    correctIndex,
  }
}

export function generateMatrix(difficulty: number, rng: Rng): MatrixTrial {
  for (let attempt = 0; attempt < 16; attempt++) {
    const config = buildConfig(difficulty, rng)
    const pool = buildPool(config)
    if (pool.length >= DISTRACTOR_COUNT) return buildTrial(config, difficulty, pool, rng)
  }
  return buildTrial(FALLBACK_CONFIG, difficulty, buildPool(FALLBACK_CONFIG), rng)
}
