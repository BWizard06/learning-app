import { describe, expect, it } from 'vitest'
import { createRng } from '~~/shared/rng'
import { runGeneratorContract } from '~~/shared/testing/generator-contract'
import { propertyRuns } from '~~/shared/testing/property'
import type { TrialResult } from '~~/shared/types'
import definition from './definition'
import {
  PART_A,
  PART_B,
  generateTrailBlock,
  latticePoints,
  type TrailNode,
  type TrailPayload,
  type TrailTrial,
} from './generator'

const DIFFICULTIES = [1, 2, 3, 4, 5]
const FIELD = 100
const RADIUS = 7

const NODES_AT: Record<number, number> = { 1: 8, 2: 11, 3: 14, 4: 17, 5: 20 }
const GAP_AT: Record<number, number> = { 1: 26, 2: 22, 3: 19, 4: 17, 5: 15 }

const LABELS_A: Record<number, string[]> = {
  1: ['1', '2', '3', '4', '5', '6', '7', '8'],
  2: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'],
  3: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14'],
  4: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17'],
  5: [
    '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
    '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
  ],
}

const LABELS_B: Record<number, string[]> = {
  1: ['1', 'A', '2', 'B', '3', 'C', '4', 'D'],
  2: ['1', 'A', '2', 'B', '3', 'C', '4', 'D', '5', 'E', '6'],
  3: ['1', 'A', '2', 'B', '3', 'C', '4', 'D', '5', 'E', '6', 'F', '7', 'G'],
  4: ['1', 'A', '2', 'B', '3', 'C', '4', 'D', '5', 'E', '6', 'F', '7', 'G', '8', 'H', '9'],
  5: [
    '1', 'A', '2', 'B', '3', 'C', '4', 'D', '5', 'E',
    '6', 'F', '7', 'G', '8', 'H', '9', 'I', '10', 'J',
  ],
}

const LABELS_BY_PART: Record<string, Record<number, string[]>> = {
  [PART_A]: LABELS_A,
  [PART_B]: LABELS_B,
}

function blockFor(index: number, salt: number): { difficulty: number; trials: TrailTrial[] } {
  const difficulty = DIFFICULTIES[index % DIFFICULTIES.length]!
  const block = generateTrailBlock(difficulty, createRng(index * salt + 1))
  return { difficulty, trials: block.trials as TrailTrial[] }
}

function nodesOf(trial: TrailTrial): TrailNode[] {
  return (trial.payload as TrailPayload).nodes
}

function labelsInOrder(trial: TrailTrial): string[] {
  const byId = new Map(nodesOf(trial).map((node) => [node.id, node.label]))
  return trial.answer.map((id) => byId.get(id) ?? '?')
}

describe('trailmaking generator', () => {
  it('satisfies the shared generator contract', () => {
    runGeneratorContract(definition, {
      minItemTypes: 2,
      checkTrial: (trial) => {
        const payload = trial.payload as TrailPayload
        expect([PART_A, PART_B]).toContain(trial.itemType)
        expect(payload.part).toBe(trial.itemType)
        expect(payload.width).toBe(FIELD)
        expect(payload.height).toBe(FIELD)
        expect(payload.radius).toBe(RADIUS)
        expect(payload.hinweis.length).toBeGreaterThan(0)
        expect(payload.titel.length).toBeGreaterThan(0)
        expect(Array.isArray(trial.answer)).toBe(true)
        expect(payload.nodes.length).toBe((trial.answer as string[]).length)
      },
    })
  })

  it('keeps every pair of circles apart by at least the gap of that level', () => {
    const runs = propertyRuns()
    const tooClose: string[] = []
    const tightest: Record<number, number> = {}

    for (let i = 0; i < runs; i++) {
      const { difficulty, trials } = blockFor(i, 2654435761)
      const gap = GAP_AT[difficulty]!
      for (const trial of trials) {
        const nodes = nodesOf(trial)
        for (let a = 0; a < nodes.length; a++) {
          for (let b = a + 1; b < nodes.length; b++) {
            const distance = Math.hypot(nodes[a]!.x - nodes[b]!.x, nodes[a]!.y - nodes[b]!.y)
            if (distance < gap - 1e-9) {
              tooClose.push(`St. ${difficulty}: ${distance.toFixed(3)} statt ${gap}`)
            }
            const best = tightest[difficulty]
            if (best === undefined || distance < best) tightest[difficulty] = distance
          }
        }
      }
    }

    expect(tooClose).toEqual([])
    for (const difficulty of DIFFICULTIES) {
      expect(tightest[difficulty]).toBeGreaterThanOrEqual(GAP_AT[difficulty]! - 1e-9)
      expect(tightest[difficulty]).toBeLessThan(GAP_AT[difficulty]! + 3)
    }
  })

  it('keeps every circle completely inside the field', () => {
    const runs = propertyRuns()
    const outside: string[] = []

    for (let i = 0; i < runs; i++) {
      const { trials } = blockFor(i, 104729)
      for (const trial of trials) {
        const payload = trial.payload as TrailPayload
        for (const node of payload.nodes) {
          const fits =
            node.x - payload.radius >= 0 &&
            node.y - payload.radius >= 0 &&
            node.x + payload.radius <= payload.width &&
            node.y + payload.radius <= payload.height
          if (!fits) outside.push(`${node.label} bei ${node.x}/${node.y}`)
        }
      }
    }

    expect(outside).toEqual([])
  })

  it('labels part A with the plain counting sequence', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const { difficulty, trials } = blockFor(i, 7919)
      const teilA = trials.find((trial) => trial.itemType === PART_A)!
      expect(labelsInOrder(teilA)).toEqual(LABELS_A[difficulty]!)
    }
  })

  it('alternates number and letter in part B', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const { difficulty, trials } = blockFor(i, 15485863)
      const teilB = trials.find((trial) => trial.itemType === PART_B)!
      expect(labelsInOrder(teilB)).toEqual(LABELS_B[difficulty]!)
    }
  })

  it('walks every circle of the field exactly once', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const { difficulty, trials } = blockFor(i, 32452843)
      for (const trial of trials) {
        const ids = nodesOf(trial).map((node) => node.id)
        const order = trial.answer
        expect(order.length).toBe(ids.length)
        expect(order.length).toBe(NODES_AT[difficulty]!)
        expect(new Set(order).size).toBe(order.length)
        expect(order.slice().sort()).toEqual(ids.slice().sort())
        expect(new Set(labelsInOrder(trial)).size).toBe(order.length)
      }
    }
  })

  it('serves both parts at every difficulty, the lowest one included', () => {
    for (const difficulty of DIFFICULTIES) {
      const seen = new Set<string>()
      for (let i = 0; i < 200; i++) {
        const block = generateTrailBlock(difficulty, createRng(i * 99991 + 3))
        const parts = block.trials.map((trial) => trial.itemType)
        expect(new Set(parts).size).toBe(2)
        for (const part of parts) seen.add(part)
      }
      expect([...seen].sort()).toEqual([PART_A, PART_B])
    }
  })

  it('mirrors payload and answer in params so a field can be rebuilt', () => {
    const runs = Math.min(propertyRuns(), 2000)
    for (let i = 0; i < runs; i++) {
      const { trials } = blockFor(i, 49979687)
      for (const trial of trials) {
        const payload = trial.payload as TrailPayload
        expect(trial.params.type).toBe(trial.itemType)
        expect(trial.params.order).toEqual(trial.answer)
        expect(trial.params.count).toBe(payload.nodes.length)
        expect(trial.params.nodes).toEqual(
          payload.nodes.map((node) => ({ id: node.id, label: node.label, x: node.x, y: node.y })),
        )
        expect(JSON.stringify(trial.params)).not.toContain('Tippe')
      }
    }
  })

  it('adds circles and packs them tighter as difficulty rises', () => {
    for (let d = 2; d <= 5; d++) {
      expect(NODES_AT[d]!).toBeGreaterThan(NODES_AT[d - 1]!)
      expect(GAP_AT[d]!).toBeLessThan(GAP_AT[d - 1]!)
    }

    for (const difficulty of DIFFICULTIES) {
      for (let i = 0; i < 40; i++) {
        const block = generateTrailBlock(difficulty, createRng(i * 2246822519 + 5))
        for (const trial of block.trials) {
          expect((trial.payload as TrailPayload).nodes.length).toBe(NODES_AT[difficulty]!)
        }
      }
    }
  })

  it('keeps the lattice fallback large enough and legal at every level', () => {
    for (const difficulty of DIFFICULTIES) {
      const gap = GAP_AT[difficulty]!
      const points = latticePoints(gap)
      expect(points.length).toBeGreaterThanOrEqual(NODES_AT[difficulty]!)
      for (const point of points) {
        expect(point.x - RADIUS).toBeGreaterThanOrEqual(0)
        expect(point.y - RADIUS).toBeGreaterThanOrEqual(0)
        expect(point.x + RADIUS).toBeLessThanOrEqual(FIELD)
        expect(point.y + RADIUS).toBeLessThanOrEqual(FIELD)
      }
      for (let a = 0; a < points.length; a++) {
        for (let b = a + 1; b < points.length; b++) {
          const distance = Math.hypot(points[a]!.x - points[b]!.x, points[a]!.y - points[b]!.y)
          expect(distance).toBeGreaterThanOrEqual(gap - 1e-9)
        }
      }
    }
  })

  it('leaves room for a circle of at least forty four pixels on a small screen', () => {
    const screenPx = 375
    const shellPaddingPx = 18
    const circleShare = 0.14
    const fieldPx = screenPx - 2 * shellPaddingPx

    expect(circleShare * FIELD).toBeGreaterThanOrEqual(2 * RADIUS)
    expect(circleShare * FIELD).toBeLessThanOrEqual(GAP_AT[5]!)
    expect(fieldPx * circleShare).toBeGreaterThanOrEqual(44)
  })
})

describe('trailmaking correctness', () => {
  const trials = generateTrailBlock(3, createRng(2024)).trials as TrailTrial[]
  const teilA = trials[0]!
  const order = teilA.answer

  it('accepts the full path in the expected order', () => {
    expect(definition.isCorrect!(teilA, order)).toBe(true)
  })

  it('accepts a path with wrong taps mixed in, because they do not advance', () => {
    expect(definition.isCorrect!(teilA, [order[1]!, order[3]!, ...order])).toBe(true)
    const detour = [order[0]!, order[4]!, order[1]!, ...order.slice(2)]
    expect(definition.isCorrect!(teilA, detour)).toBe(true)
  })

  it('rejects an unfinished, a scrambled and an empty path', () => {
    expect(definition.isCorrect!(teilA, order.slice(0, order.length - 1))).toBe(false)
    expect(definition.isCorrect!(teilA, [order[1]!, order[0]!, ...order.slice(2)])).toBe(false)
    expect(definition.isCorrect!(teilA, order.slice().reverse())).toBe(false)
    expect(definition.isCorrect!(teilA, [])).toBe(false)
    expect(definition.isCorrect!(teilA, 5)).toBe(false)
  })

  it('still accepts the path when a tap arrives after the last circle', () => {
    expect(definition.isCorrect!(teilA, [...order, order[0]!])).toBe(true)
  })
})

describe('trailmaking scoring', () => {
  function fields(difficulty: number, seed: number): TrailTrial[] {
    return generateTrailBlock(difficulty, createRng(seed)).trials as TrailTrial[]
  }

  function resultOf(trial: TrailTrial, taps: string[], rtMs: number, idx: number): TrialResult {
    return {
      idx,
      itemType: trial.itemType,
      difficulty: trial.difficulty,
      params: trial.params,
      response: taps,
      correct: true,
      rtMs,
      presentedAt: 0,
    }
  }

  it('reports the medians per part and their difference', () => {
    const first = fields(1, 41)
    const second = fields(1, 77)
    const results = [
      resultOf(first[0]!, first[0]!.answer, 10000, 0),
      resultOf(first[1]!, first[1]!.answer, 30000, 1),
      resultOf(second[0]!, second[0]!.answer, 20000, 2),
      resultOf(second[1]!, second[1]!.answer, 40000, 3),
    ]

    const score = definition.score(results, 120)
    expect(score.metrics.teilAMs).toBe(15000)
    expect(score.metrics.teilBMs).toBe(35000)
    expect(score.metrics.differenzMs).toBe(20000)
    expect(score.metrics.knoten).toBe(32)
    expect(score.metrics.fehler).toBe(0)
    expect(score.accuracy).toBe(1)
  })

  it('counts every tap that did not advance the path as an error', () => {
    const pair = fields(2, 8123)
    const teilA = pair[0]!
    const order = teilA.answer
    const noisy = [order[2]!, order[5]!, order[1]!, ...order]

    const score = definition.score([resultOf(teilA, noisy, 25000, 0)], 60)
    expect(score.metrics.fehler).toBe(3)
    expect(score.metrics.knoten).toBe(11)
    expect(score.accuracy).toBeCloseTo(11 / 14, 10)
  })

  it('counts only the circles that were really reached', () => {
    const pair = fields(1, 5150)
    const teilA = pair[0]!
    const half = teilA.answer.slice(0, 3)

    const score = definition.score([resultOf(teilA, half, 9000, 0)], 60)
    expect(score.metrics.knoten).toBe(3)
    expect(score.metrics.fehler).toBe(0)
  })

  it('rewards finished fields per minute and scales them with difficulty', () => {
    const easy = fields(1, 12)
    const hard = fields(5, 12)
    const easyResults = [
      resultOf(easy[0]!, easy[0]!.answer, 12000, 0),
      resultOf(easy[1]!, easy[1]!.answer, 18000, 1),
    ]
    const hardResults = [
      resultOf(hard[0]!, hard[0]!.answer, 12000, 0),
      resultOf(hard[1]!, hard[1]!.answer, 18000, 1),
    ]

    expect(definition.score(easyResults, 120).raw).toBeCloseTo(1, 10)
    expect(definition.score(hardResults, 120).raw).toBeCloseTo(2, 10)
    expect(definition.score(easyResults, 60).raw).toBeCloseTo(2, 10)
  })

  it('ignores fields that were never finished when computing the raw value', () => {
    const pair = fields(1, 909)
    const abandoned: TrialResult = { ...resultOf(pair[0]!, [], 12000, 0), correct: false }
    expect(definition.score([abandoned], 60).raw).toBe(0)
  })

  it('reports zero for an empty session without throwing', () => {
    const score = definition.score([], 60)
    expect(score.raw).toBe(0)
    expect(score.accuracy).toBe(0)
    expect(score.metrics.fehler).toBe(0)
    expect(score.metrics.knoten).toBe(0)
    expect(score.metrics.teilAMs).toBe(0)
    expect(score.metrics.teilBMs).toBe(0)
    expect(score.metrics.differenzMs).toBe(0)
  })

  it('hides the accuracy figure because every finished field is correct', () => {
    expect(definition.scoresCorrectness).toBe(false)
  })
})
