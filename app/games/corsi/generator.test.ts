import { describe, expect, it } from 'vitest'
import { createRng } from '~~/shared/rng'
import { runGeneratorContract } from '~~/shared/testing/generator-contract'
import { propertyRuns } from '~~/shared/testing/property'
import type { TrialResult } from '~~/shared/types'
import definition from './definition'
import {
  BLOCKS,
  BLOCK_RATIO,
  BOARD_ASPECT,
  ITEM_TYPES,
  MAX_SPAN,
  MIN_SPAN,
  directionFor,
  generateCorsi,
  spanLengthFor,
  type CorsiPayload,
  type Direction,
} from './generator'

const DIFFICULTIES = [2, 3, 4, 5, 6, 7, 8, 9]
const LOWEST_DIFFICULTY = 2

const LENGTH_TABLE: Record<number, number> = {
  '-4': 2,
  '-1': 2,
  0: 2,
  1: 2,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 9,
  11: 9,
  14: 9,
}

const DIRECTION_TABLE: Record<number, Direction> = {
  1: 'rueckwaerts',
  2: 'rueckwaerts',
  3: 'vorwaerts',
  4: 'vorwaerts',
  5: 'vorwaerts',
  6: 'rueckwaerts',
  7: 'vorwaerts',
  8: 'vorwaerts',
  12345: 'rueckwaerts',
  99991: 'vorwaerts',
}

const VIEWPORT_PX = 375
const SHELL_PADDING_PX = 18
const MIN_BLOCK_PX = 56

function boardSize(): { width: number; height: number; side: number } {
  const width = VIEWPORT_PX - 2 * SHELL_PADDING_PX
  return { width, height: width * BOARD_ASPECT, side: width * BLOCK_RATIO }
}

function trialAt(difficulty: number, seed: number) {
  const trial = generateCorsi(difficulty, createRng(seed))
  return { trial, payload: trial.payload as CorsiPayload }
}

describe('corsi generator', () => {
  it('satisfies the shared generator contract', () => {
    runGeneratorContract(definition, {
      minItemTypes: ITEM_TYPES.length,
      checkTrial: (trial) => {
        const payload = trial.payload as CorsiPayload
        expect(ITEM_TYPES).toContain(trial.itemType)
        expect(payload.prompt.length).toBeGreaterThan(0)
        expect(Array.isArray(payload.sequence)).toBe(true)
        expect(Array.isArray(trial.answer)).toBe(true)
      },
    })
  })

  it('matches a hand written table of span lengths', () => {
    for (const [difficulty, length] of Object.entries(LENGTH_TABLE)) {
      expect(spanLengthFor(Number(difficulty)), `difficulty ${difficulty}`).toBe(length)
    }
    expect(spanLengthFor(MIN_SPAN)).toBe(MIN_SPAN)
    expect(spanLengthFor(MAX_SPAN)).toBe(MAX_SPAN)
  })

  it('gives every sequence the declared length', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const difficulty = DIFFICULTIES[i % DIFFICULTIES.length]!
      const { trial, payload } = trialAt(difficulty, i * 2654435761 + 1)
      const expected = LENGTH_TABLE[difficulty]!
      expect(payload.length).toBe(expected)
      expect(payload.sequence.length).toBe(expected)
      expect(trial.answer.length).toBe(expected)
      expect(trial.params.length).toBe(expected)
      expect(trial.difficulty).toBe(difficulty)
    }
  })

  it('keeps every block index inside the board and never repeats one in a row', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const difficulty = DIFFICULTIES[i % DIFFICULTIES.length]!
      const { payload } = trialAt(difficulty, i * 104729 + 17)
      const sequence = payload.sequence

      for (const index of sequence) {
        expect(Number.isInteger(index)).toBe(true)
        expect(index).toBeGreaterThanOrEqual(0)
        expect(index).toBeLessThanOrEqual(BLOCKS.length - 1)
      }

      for (let step = 1; step < sequence.length; step++) {
        expect(sequence[step], `seed ${i} repeats block at step ${step}`).not.toBe(sequence[step - 1])
      }

      expect(new Set(sequence).size).toBe(sequence.length)
    }
  })

  it('turns the sequence around only for the backward item type', () => {
    const runs = propertyRuns()
    const seenPerDirection = new Map<string, number>()

    for (let i = 0; i < runs; i++) {
      const difficulty = DIFFICULTIES[i % DIFFICULTIES.length]!
      const { trial, payload } = trialAt(difficulty, i * 7919 + 3)
      const sequence = payload.sequence
      const answer = trial.answer
      const last = sequence.length - 1

      for (let step = 0; step <= last; step++) {
        const wanted = trial.itemType === 'vorwaerts' ? sequence[step] : sequence[last - step]
        expect(answer[step], `seed ${i} step ${step}`).toBe(wanted)
      }

      seenPerDirection.set(trial.itemType, (seenPerDirection.get(trial.itemType) ?? 0) + 1)
    }

    expect([...seenPerDirection.keys()].sort()).toEqual([...ITEM_TYPES].sort())
  })

  it('reaches both directions at every span length, the shortest included', () => {
    const perDifficulty = new Map<number, Set<string>>()
    for (const difficulty of DIFFICULTIES) {
      const seen = new Set<string>()
      for (let i = 0; i < 400; i++) {
        seen.add(generateCorsi(difficulty, createRng(i * 31 + 5)).itemType)
      }
      perDifficulty.set(difficulty, seen)
    }

    for (const difficulty of DIFFICULTIES) {
      expect([...perDifficulty.get(difficulty)!].sort(), `difficulty ${difficulty}`).toEqual(
        [...ITEM_TYPES].sort(),
      )
    }

    let backward = 0
    const lowest = 2000
    for (let i = 0; i < lowest; i++) {
      if (generateCorsi(LOWEST_DIFFICULTY, createRng(i * 15485863 + 11)).itemType === 'rueckwaerts') {
        backward++
      }
    }
    expect(backward / lowest).toBeGreaterThan(0.35)
    expect(backward / lowest).toBeLessThan(0.65)
  })

  it('fixes the direction per session and never changes it mid session', () => {
    for (const seed of [7, 12345, 99991, 424242]) {
      const rng = createRng(seed)
      const types = new Set<string>()
      for (let i = 0; i < 20; i++) {
        types.add(generateCorsi(DIFFICULTIES[i % DIFFICULTIES.length]!, rng).itemType)
      }
      expect(types.size, `seed ${seed} switched direction mid session`).toBe(1)

      const fresh = new Set<string>()
      for (const difficulty of DIFFICULTIES) {
        fresh.add(generateCorsi(difficulty, createRng(seed)).itemType)
      }
      expect([...fresh]).toEqual([...types])
    }
  })

  it('reads the direction from a hand written table of seeds', () => {
    for (const [seed, direction] of Object.entries(DIRECTION_TABLE)) {
      expect(directionFor(Number(seed)), `seed ${seed}`).toBe(direction)
      expect(generateCorsi(4, createRng(Number(seed))).itemType).toBe(direction)
    }
  })

  it('asks for the direction that the item type promises', () => {
    const prompts = new Map<string, Set<string>>()
    for (let i = 0; i < 600; i++) {
      const { trial, payload } = trialAt(DIFFICULTIES[i % DIFFICULTIES.length]!, i * 40503 + 21)
      const bucket = prompts.get(trial.itemType) ?? new Set<string>()
      bucket.add(payload.prompt)
      prompts.set(trial.itemType, bucket)
    }

    expect([...prompts.keys()].sort()).toEqual([...ITEM_TYPES].sort())
    for (const [type, texts] of prompts) {
      expect(texts.size, `${type} carries more than one prompt`).toBe(1)
    }

    const forward = [...prompts.get('vorwaerts')!][0]!
    const backward = [...prompts.get('rueckwaerts')!][0]!
    expect(forward).not.toBe(backward)
    expect(forward.toLowerCase()).toContain('derselben reihenfolge')
    expect(backward.toLowerCase()).toContain('umgekehrter reihenfolge')
  })

  it('spreads the lit blocks evenly over the board', () => {
    const rounds = 4000
    const inSequence = new Array<number>(BLOCKS.length).fill(0)
    const firstLit = new Array<number>(BLOCKS.length).fill(0)

    for (let i = 0; i < rounds; i++) {
      const { payload } = trialAt(LOWEST_DIFFICULTY, i * 2246822519 + 9)
      for (const index of payload.sequence) inSequence[index]!++
      firstLit[payload.sequence[0]!]!++
    }

    for (let index = 0; index < BLOCKS.length; index++) {
      expect(inSequence[index]! / rounds, `block ${index} appears too rarely or too often`).toBeGreaterThan(0.18)
      expect(inSequence[index]! / rounds).toBeLessThan(0.27)
      expect(firstLit[index]! / rounds, `block ${index} starts too rarely or too often`).toBeGreaterThan(0.08)
      expect(firstLit[index]! / rounds).toBeLessThan(0.145)
    }
  })

  it('uses all nine blocks once the span is at its longest', () => {
    for (let i = 0; i < 200; i++) {
      const { payload } = trialAt(MAX_SPAN, i * 99991 + 13)
      expect([...payload.sequence].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    }
  })

  it('mirrors the sequence in params so the trial can be rebuilt', () => {
    const runs = Math.min(propertyRuns(), 2000)
    for (let i = 0; i < runs; i++) {
      const difficulty = DIFFICULTIES[i % DIFFICULTIES.length]!
      const { trial, payload } = trialAt(difficulty, i * 32452843 + 7)
      expect(trial.params.sequence).toEqual(payload.sequence)
      expect(trial.params.type).toBe(trial.itemType)
      expect(trial.params.stepMs).toBe(payload.stepMs)
      expect(trial.params.gapMs).toBe(payload.gapMs)
      expect(JSON.stringify(trial.params)).not.toContain(payload.prompt)
    }
  })

  it('produces the same trial twice for the same seed', () => {
    for (const difficulty of DIFFICULTIES) {
      const a = generateCorsi(difficulty, createRng(20260828))
      const b = generateCorsi(difficulty, createRng(20260828))
      expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    }
  })
})

describe('corsi board', () => {
  it('keeps every block big enough and clearly apart at the smallest screen', () => {
    const { width, height, side } = boardSize()
    expect(BLOCKS.length).toBe(9)
    expect(MAX_SPAN).toBe(BLOCKS.length)
    expect(side).toBeGreaterThanOrEqual(MIN_BLOCK_PX)

    for (const [index, spot] of BLOCKS.entries()) {
      expect(spot.x * width - side / 2, `block ${index} left edge`).toBeGreaterThanOrEqual(0)
      expect(spot.x * width + side / 2, `block ${index} right edge`).toBeLessThanOrEqual(width)
      expect(spot.y * height - side / 2, `block ${index} top edge`).toBeGreaterThanOrEqual(0)
      expect(spot.y * height + side / 2, `block ${index} bottom edge`).toBeLessThanOrEqual(height)
    }

    let smallestGap = Number.POSITIVE_INFINITY
    let smallestCentreDistance = Number.POSITIVE_INFINITY
    for (let i = 0; i < BLOCKS.length; i++) {
      for (let j = i + 1; j < BLOCKS.length; j++) {
        const dx = Math.abs(BLOCKS[i]!.x - BLOCKS[j]!.x) * width
        const dy = Math.abs(BLOCKS[i]!.y - BLOCKS[j]!.y) * height
        smallestGap = Math.min(smallestGap, Math.max(dx, dy) - side)
        smallestCentreDistance = Math.min(smallestCentreDistance, Math.hypot(dx, dy))
      }
    }

    expect(smallestGap).toBeGreaterThanOrEqual(16)
    expect(smallestCentreDistance).toBeGreaterThanOrEqual(side + 24)
  })

  it('scatters the blocks instead of lining them up on a grid', () => {
    expect(new Set(BLOCKS.map((spot) => spot.x)).size).toBe(BLOCKS.length)
    expect(new Set(BLOCKS.map((spot) => spot.y)).size).toBe(BLOCKS.length)

    let smallestArea = Number.POSITIVE_INFINITY
    for (let i = 0; i < BLOCKS.length; i++) {
      for (let j = i + 1; j < BLOCKS.length; j++) {
        for (let k = j + 1; k < BLOCKS.length; k++) {
          const a = BLOCKS[i]!
          const b = BLOCKS[j]!
          const c = BLOCKS[k]!
          const area = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2
          smallestArea = Math.min(smallestArea, area)
        }
      }
    }
    expect(smallestArea).toBeGreaterThan(0.002)
  })
})

describe('corsi answers', () => {
  function trialFor(difficulty: number, seed: number) {
    return generateCorsi(difficulty, createRng(seed))
  }

  it('accepts only the exact order', () => {
    const trial = trialFor(5, 8081)
    const answer = trial.answer

    expect(definition.isCorrect!(trial, answer)).toBe(true)
    expect(definition.isCorrect!(trial, [...answer].reverse())).toBe(false)
    expect(definition.isCorrect!(trial, answer.slice(0, -1))).toBe(false)
    expect(definition.isCorrect!(trial, [...answer, answer[0]!])).toBe(false)
    expect(definition.isCorrect!(trial, [])).toBe(false)

    const swapped = [...answer]
    const first = swapped[0]!
    swapped[0] = swapped[1]!
    swapped[1] = first
    expect(definition.isCorrect!(trial, swapped)).toBe(false)
  })

  it('refuses responses that are not a list of block indices', () => {
    const trial = trialFor(4, 5150)
    expect(definition.isCorrect!(trial, null)).toBe(false)
    expect(definition.isCorrect!(trial, 3)).toBe(false)
    expect(definition.isCorrect!(trial, 'oben links')).toBe(false)
    expect(definition.isCorrect!(trial, [...trial.answer.slice(0, -1), 9])).toBe(false)
    expect(definition.isCorrect!(trial, [...trial.answer.slice(0, -1), -1])).toBe(false)
    expect(definition.isCorrect!(trial, [...trial.answer.slice(0, -1), 2.5])).toBe(false)
  })
})

describe('corsi scoring', () => {
  function resultOf(
    length: number,
    correct: boolean,
    rtMs = 4000,
    direction: Direction = 'vorwaerts',
  ): TrialResult {
    return {
      idx: 0,
      itemType: direction,
      difficulty: length,
      params: { type: direction, length, sequence: [] },
      response: [],
      correct,
      rtMs,
      presentedAt: 0,
    }
  }

  it('reports the longest sequence that was reproduced correctly', () => {
    const score = definition.score(
      [
        resultOf(2, true),
        resultOf(2, true),
        resultOf(3, true),
        resultOf(3, false),
        resultOf(4, false),
        resultOf(4, false),
      ],
      120,
    )

    expect(score.raw).toBe(3)
    expect(score.metrics.spanne).toBe(3)
    expect(score.metrics.versuche).toBe(6)
    expect(score.metrics.korrekt).toBe(3)
    expect(score.accuracy).toBeCloseTo(0.5, 10)
  })

  it('never credits a span that was only attempted', () => {
    const score = definition.score([resultOf(2, true), resultOf(7, false), resultOf(9, false)], 120)
    expect(score.raw).toBe(2)
    expect(score.metrics.spanne).toBe(2)
  })

  it('marks the direction of the session', () => {
    const forward = definition.score([resultOf(3, true, 4000, 'vorwaerts')], 120)
    const backward = definition.score([resultOf(3, true, 4000, 'rueckwaerts')], 120)
    expect(forward.metrics.richtung).toBe(0)
    expect(backward.metrics.richtung).toBe(1)
  })

  it('takes the median time from the correct trials only', () => {
    const score = definition.score(
      [
        resultOf(2, true, 1000),
        resultOf(2, true, 3000),
        resultOf(3, true, 5000),
        resultOf(3, false, 99000),
      ],
      120,
    )
    expect(score.metrics.medianRtMs).toBe(3000)
  })

  it('reports zero for an empty session without throwing', () => {
    const score = definition.score([], 120)
    expect(score.raw).toBe(0)
    expect(score.accuracy).toBe(0)
    expect(score.metrics.spanne).toBe(0)
    expect(score.metrics.versuche).toBe(0)
    expect(score.metrics.korrekt).toBe(0)
    expect(score.metrics.medianRtMs).toBe(0)
    expect(score.metrics.richtung).toBe(0)
  })

  it('places the note thresholds around a realistic span', () => {
    expect(definition.thresholds.raw1).toBe(MIN_SPAN)
    expect(definition.thresholds.raw6).toBeLessThanOrEqual(MAX_SPAN)
    expect(definition.difficultyRange).toEqual([MIN_SPAN, MAX_SPAN])
    expect(definition.weight(MAX_SPAN)).toBeGreaterThan(definition.weight(MIN_SPAN))
    expect(definition.mode).toBe('span')
  })
})
