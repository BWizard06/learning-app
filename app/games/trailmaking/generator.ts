import type { Rng } from '~~/shared/rng'
import type { JsonObject, JsonValue, Trial, TrialBlock } from '~~/shared/types'

export const FIELD_SIZE = 100
export const NODE_RADIUS = 7

export const PART_A = 'teil-a'
export const PART_B = 'teil-b'
export const BLOCK_ITEM_TYPE = 'feldpaar'
export const ITEM_TYPES = [PART_A, PART_B] as const

export type PartType = (typeof ITEM_TYPES)[number]

export interface TrailNode {
  id: string
  label: string
  x: number
  y: number
}

export interface TrailPayload {
  part: PartType
  titel: string
  hinweis: string
  radius: number
  width: number
  height: number
  nodes: TrailNode[]
}

export type TrailTrial = Trial<TrailPayload, string[]>
export type TrailBlock = TrialBlock<TrailPayload, string[]>

export interface Point {
  x: number
  y: number
}

export interface Walk {
  visited: number
  errors: number
}

const NODE_COUNTS: readonly number[] = [8, 11, 14, 17, 20]
const MIN_DISTANCES: readonly number[] = [26, 22, 19, 17, 15]
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

const PLACEMENT_ATTEMPTS = 200
const PLACEMENT_ROUNDS = 4

const TITLES: Record<PartType, string> = {
  [PART_A]: 'Teil A',
  [PART_B]: 'Teil B',
}

function level(difficulty: number): number {
  const rounded = Math.round(difficulty)
  const clamped = Math.min(NODE_COUNTS.length, Math.max(1, rounded))
  return clamped - 1
}

export function nodeCountFor(difficulty: number): number {
  return NODE_COUNTS[level(difficulty)]!
}

export function minDistanceFor(difficulty: number): number {
  return MIN_DISTANCES[level(difficulty)]!
}

export function labelsFor(part: PartType, count: number): string[] {
  const labels: string[] = []
  if (part === PART_A) {
    for (let i = 1; i <= count; i++) labels.push(String(i))
    return labels
  }
  let numeral = 1
  let letter = 0
  for (let i = 0; i < count; i++) {
    if (i % 2 === 0) labels.push(String(numeral++))
    else labels.push(LETTERS[letter++]!)
  }
  return labels
}

function hintFor(part: PartType, count: number): string {
  if (part === PART_A) return `Tippe die Zahlen 1 bis ${count} der Reihe nach an.`
  return 'Tippe abwechselnd Zahl und Buchstabe an, also 1, A, 2, B und so weiter.'
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function farEnough(points: readonly Point[], x: number, y: number, minDistance: number): boolean {
  const limit = minDistance * minDistance
  for (const point of points) {
    const dx = point.x - x
    const dy = point.y - y
    if (dx * dx + dy * dy < limit) return false
  }
  return true
}

function attemptScatter(count: number, minDistance: number, rng: Rng): Point[] | null {
  const lo = NODE_RADIUS
  const hi = FIELD_SIZE - NODE_RADIUS
  const points: Point[] = []

  for (let i = 0; i < count; i++) {
    let placed = false
    for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS && !placed; attempt++) {
      const x = round2(rng.float(lo, hi))
      const y = round2(rng.float(lo, hi))
      if (!farEnough(points, x, y, minDistance)) continue
      points.push({ x, y })
      placed = true
    }
    if (!placed) return null
  }
  return points
}

export function latticePoints(minDistance: number): Point[] {
  const lo = NODE_RADIUS
  const hi = FIELD_SIZE - NODE_RADIUS
  const points: Point[] = []
  for (let row = 0; lo + row * minDistance <= hi; row++) {
    for (let col = 0; lo + col * minDistance <= hi; col++) {
      points.push({ x: round2(lo + col * minDistance), y: round2(lo + row * minDistance) })
    }
  }
  return points
}

export function scatterNodes(count: number, minDistance: number, rng: Rng): Point[] {
  for (let round = 0; round < PLACEMENT_ROUNDS; round++) {
    const points = attemptScatter(count, minDistance, rng)
    if (points) return points
  }
  return rng.sample(latticePoints(minDistance), count)
}

export function idsFrom(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const entry of value) {
    if (typeof entry === 'string') out.push(entry)
  }
  return out
}

export function orderFromParams(params: JsonObject): string[] {
  return idsFrom(params.order)
}

export function walkTaps(expected: readonly string[], taps: readonly string[]): Walk {
  let visited = 0
  let errors = 0
  for (const tap of taps) {
    if (visited < expected.length && tap === expected[visited]) visited++
    else errors++
  }
  return { visited, errors }
}

function nodeToJson(node: TrailNode): JsonObject {
  return { id: node.id, label: node.label, x: node.x, y: node.y }
}

function buildField(part: PartType, difficulty: number, rng: Rng): TrailTrial {
  const count = nodeCountFor(difficulty)
  const minDistance = minDistanceFor(difficulty)
  const points = scatterNodes(count, minDistance, rng)
  const labels = labelsFor(part, count)
  const positionOrder = rng.shuffle(points.map((_, index) => index))

  const labelByPoint: string[] = new Array<string>(count)
  for (let step = 0; step < positionOrder.length; step++) {
    labelByPoint[positionOrder[step]!] = labels[step]!
  }

  const nodes: TrailNode[] = points.map((point, index) => ({
    id: `k${index}`,
    label: labelByPoint[index]!,
    x: point.x,
    y: point.y,
  }))
  const order = positionOrder.map((index) => `k${index}`)

  return {
    itemType: part,
    difficulty,
    params: {
      type: part,
      count,
      minDistance,
      radius: NODE_RADIUS,
      width: FIELD_SIZE,
      height: FIELD_SIZE,
      nodes: nodes.map(nodeToJson) as JsonValue,
      order: order as JsonValue,
    },
    payload: {
      part,
      titel: TITLES[part],
      hinweis: hintFor(part, count),
      radius: NODE_RADIUS,
      width: FIELD_SIZE,
      height: FIELD_SIZE,
      nodes,
    },
    answer: order,
  }
}

export function generateTrailBlock(difficulty: number, rng: Rng): TrailBlock {
  const teilA = buildField(PART_A, difficulty, rng)
  const teilB = buildField(PART_B, difficulty, rng)

  return {
    kind: 'block',
    itemType: BLOCK_ITEM_TYPE,
    difficulty,
    params: {
      type: BLOCK_ITEM_TYPE,
      parts: [PART_A, PART_B],
      count: nodeCountFor(difficulty),
      minDistance: minDistanceFor(difficulty),
    },
    payload: teilA.payload,
    trials: [teilA, teilB],
  }
}
