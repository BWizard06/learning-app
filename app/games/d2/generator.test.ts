import { describe, expect, it } from 'vitest'
import { createRng } from '~~/shared/rng'
import { runGeneratorContract } from '~~/shared/testing/generator-contract'
import { propertyRuns } from '~~/shared/testing/property'
import type { JsonObject, TrialResult } from '~~/shared/types'
import definition from './definition'
import {
  ITEM_TYPE,
  MAX_MARKS,
  MAX_MARKS_PER_SIDE,
  MIN_MARKS,
  charsFromParams,
  generateRow,
  hardShareFor,
  isHardDistractor,
  isTarget,
  rowLengthFor,
  type D2Char,
} from './generator'

const DIFFICULTIES = [1, 2, 3, 4, 5, 6]

const TARGET_FORMS = ['d20', 'd11', 'd02']

function form(char: D2Char): string {
  return `${char.letter}${char.above}${char.below}`
}

function shouldBeTarget(char: D2Char): boolean {
  return TARGET_FORMS.includes(form(char))
}

function rowFor(index: number, salt: number): { chars: D2Char[]; targets: number[]; difficulty: number } {
  const difficulty = DIFFICULTIES[index % DIFFICULTIES.length]!
  const trial = generateRow(difficulty, createRng(index * salt + 1))
  return { chars: trial.payload, targets: trial.answer, difficulty }
}

describe('d2 generator', () => {
  it('satisfies the shared generator contract', () => {
    runGeneratorContract(definition, {
      minItemTypes: 1,
      checkTrial: (trial) => {
        expect(trial.itemType).toBe(ITEM_TYPE)
        expect(Array.isArray(trial.payload)).toBe(true)
        expect(Array.isArray(trial.answer)).toBe(true)
        expect((trial.payload as D2Char[]).length).toBeGreaterThanOrEqual(16)
        expect((trial.payload as D2Char[]).length).toBeLessThanOrEqual(24)
      },
    })
  })

  it('keeps the target share between forty and fifty percent', () => {
    const runs = propertyRuns()
    let targets = 0
    let characters = 0
    for (let i = 0; i < runs; i++) {
      const { chars, targets: indices } = rowFor(i, 2654435761)
      const share = indices.length / chars.length
      expect(share).toBeGreaterThanOrEqual(0.4)
      expect(share).toBeLessThanOrEqual(0.5)
      targets += indices.length
      characters += chars.length
    }
    const overall = targets / characters
    expect(overall).toBeGreaterThanOrEqual(0.4)
    expect(overall).toBeLessThanOrEqual(0.5)
  })

  it('declares only a d with exactly two marks as target', () => {
    const runs = propertyRuns()
    const wrong: D2Char[] = []
    for (let i = 0; i < runs; i++) {
      const { chars, targets } = rowFor(i, 104729)
      for (const index of targets) {
        const char = chars[index]!
        if (char.letter !== 'd' || char.above + char.below !== 2) wrong.push(char)
      }
    }
    expect(wrong).toEqual([])
  })

  it('never leaves a d with exactly two marks out of the target list', () => {
    const runs = propertyRuns()
    const missed: D2Char[] = []
    for (let i = 0; i < runs; i++) {
      const { chars, targets } = rowFor(i, 7919)
      const declared = new Set(targets)
      for (let index = 0; index < chars.length; index++) {
        if (declared.has(index)) continue
        if (shouldBeTarget(chars[index]!)) missed.push(chars[index]!)
      }
    }
    expect(missed).toEqual([])
  })

  it('matches the target indices to the row exactly', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const { chars, targets } = rowFor(i, 15485863)
      const recomputed = chars.map((char, index) => (shouldBeTarget(char) ? index : -1)).filter((v) => v >= 0)
      expect(targets).toEqual(recomputed)
      expect(new Set(targets).size).toBe(targets.length)
    }
  })

  it('gives every character one to four marks with at most two per side', () => {
    const runs = propertyRuns()
    const invalid: D2Char[] = []
    const shapes = new Set<string>()
    for (let i = 0; i < runs; i++) {
      const { chars } = rowFor(i, 32452843)
      for (const char of chars) {
        const total = char.above + char.below
        const ok =
          (char.letter === 'd' || char.letter === 'p') &&
          char.above >= 0 &&
          char.above <= MAX_MARKS_PER_SIDE &&
          char.below >= 0 &&
          char.below <= MAX_MARKS_PER_SIDE &&
          total >= MIN_MARKS &&
          total <= MAX_MARKS
        if (!ok) invalid.push(char)
        shapes.add(`${char.letter}${char.above}${char.below}`)
      }
    }
    expect(invalid).toEqual([])
    expect(shapes.size).toBe(16)
  })

  it('scatters the targets over every position of the row', () => {
    for (const difficulty of DIFFICULTIES) {
      const rows = 1500
      const length = rowLengthFor(difficulty)
      const hits = new Array<number>(length).fill(0)
      let meanPosition = 0

      for (let i = 0; i < rows; i++) {
        const trial = generateRow(difficulty, createRng(i * 2246822519 + 7))
        expect(trial.payload.length).toBe(length)
        for (const index of trial.answer) hits[index]!++
        meanPosition +=
          trial.answer.reduce((sum, index) => sum + index / (length - 1), 0) / trial.answer.length
      }

      const shares = hits.map((count) => count / rows)
      expect(Math.min(...shares)).toBeGreaterThan(0.33)
      expect(Math.max(...shares)).toBeLessThan(0.56)
      expect(meanPosition / rows).toBeGreaterThan(0.46)
      expect(meanPosition / rows).toBeLessThan(0.54)
    }
  })

  it('mirrors the payload in params so the row can be reconstructed', () => {
    const runs = Math.min(propertyRuns(), 2000)
    for (let i = 0; i < runs; i++) {
      const difficulty = DIFFICULTIES[i % DIFFICULTIES.length]!
      const trial = generateRow(difficulty, createRng(i * 99991 + 5))
      expect(charsFromParams(trial.params as JsonObject)).toEqual(trial.payload)
      expect((trial.params as JsonObject).targets).toEqual(trial.answer)
      expect((trial.params as JsonObject).length).toBe(trial.payload.length)
    }
  })

  it('makes rows longer and distractors harder as difficulty rises', () => {
    for (let d = 2; d <= 6; d++) {
      expect(rowLengthFor(d)).toBeGreaterThanOrEqual(rowLengthFor(d - 1))
      expect(hardShareFor(d)).toBeGreaterThan(hardShareFor(d - 1))
    }
    expect(rowLengthFor(6)).toBeGreaterThan(rowLengthFor(1))

    const hardRatio = (difficulty: number) => {
      let hard = 0
      let distractors = 0
      for (let i = 0; i < 600; i++) {
        for (const char of generateRow(difficulty, createRng(i * 37 + difficulty)).payload) {
          if (isTarget(char)) continue
          distractors++
          if (isHardDistractor(char)) hard++
        }
      }
      return hard / distractors
    }
    expect(hardRatio(6)).toBeGreaterThan(hardRatio(1))
  })

  it('produces the same row twice for the same seed', () => {
    for (const difficulty of DIFFICULTIES) {
      const a = generateRow(difficulty, createRng(12345))
      const b = generateRow(difficulty, createRng(12345))
      expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    }
  })
})

describe('d2 scoring', () => {
  function resultFor(marked: number[], difficulty = 3, rtMs = 12000): TrialResult {
    const trial = generateRow(difficulty, createRng(difficulty * 13 + 1))
    return {
      idx: 0,
      itemType: trial.itemType,
      difficulty,
      params: trial.params,
      response: marked,
      correct: false,
      rtMs,
      presentedAt: 0,
    }
  }

  function perfectResult(difficulty = 3, rtMs = 12000): TrialResult {
    const trial = generateRow(difficulty, createRng(difficulty * 13 + 1))
    return { ...resultFor(trial.answer, difficulty, rtMs), correct: true }
  }

  it('counts hits, omissions and commissions per row', () => {
    const trial = generateRow(3, createRng(40))
    const targets = trial.answer
    const nonTarget = trial.payload.findIndex((char) => !isTarget(char))
    const marked = [...targets.slice(1), nonTarget]

    const score = definition.score(
      [
        {
          idx: 0,
          itemType: trial.itemType,
          difficulty: 3,
          params: trial.params,
          response: marked,
          correct: false,
          rtMs: 9000,
          presentedAt: 0,
        },
      ],
      60,
    )

    expect(score.metrics.treffer).toBe(targets.length - 1)
    expect(score.metrics.auslassungen).toBe(1)
    expect(score.metrics.verwechslungen).toBe(1)
    expect(score.metrics.bearbeitet).toBe(trial.payload.length)
    expect(score.metrics.fehlerprozent).toBeCloseTo((2 / trial.payload.length) * 100, 0)
    expect(score.accuracy).toBeCloseTo((trial.payload.length - 2) / trial.payload.length, 6)
  })

  it('reports the spread between the fastest and the slowest row', () => {
    const score = definition.score([perfectResult(3, 5000), perfectResult(3, 18000), perfectResult(3, 9000)], 60)
    expect(score.metrics.schwankungsbreite).toBe(13000)
    expect(score.metrics.zeilen).toBe(3)
  })

  it('rewards a flawless row and scales the raw value with difficulty', () => {
    const easy = definition.score([perfectResult(1)], 60)
    const hard = definition.score([perfectResult(6)], 60)
    expect(easy.accuracy).toBe(1)
    expect(hard.accuracy).toBe(1)
    expect(easy.metrics.auslassungen).toBe(0)
    expect(easy.metrics.verwechslungen).toBe(0)
    expect(hard.raw).toBeGreaterThan(easy.raw)
  })

  it('floors the raw value at zero when errors outweigh hits', () => {
    const trial = generateRow(3, createRng(3 * 13 + 1))
    const everything = trial.payload.map((_, index) => index)
    const score = definition.score([resultFor(everything)], 60)
    expect(score.raw).toBe(0)
    expect(score.metrics.verwechslungen).toBe(trial.payload.length - trial.answer.length)
  })

  it('reports zero for an empty session without throwing', () => {
    const score = definition.score([], 60)
    expect(score.raw).toBe(0)
    expect(score.accuracy).toBe(0)
    expect(score.metrics.bearbeitet).toBe(0)
    expect(score.metrics.schwankungsbreite).toBe(0)
  })

  it('charges an omission twice as much as a wrong mark', () => {
    const trial = generateRow(5, createRng(2024))
    const nonTarget = trial.payload.findIndex((char) => !isTarget(char))
    const rowResult = (marked: number[]): TrialResult => ({
      idx: 0,
      itemType: trial.itemType,
      difficulty: 5,
      params: trial.params,
      response: marked,
      correct: false,
      rtMs: 10000,
      presentedAt: 0,
    })

    const flawless = definition.score([rowResult(trial.answer)], 60).raw
    const oneMissed = definition.score([rowResult(trial.answer.slice(1))], 60).raw
    const oneExtra = definition.score([rowResult([...trial.answer, nonTarget])], 60).raw

    const unit = flawless / trial.answer.length
    expect(flawless - oneExtra).toBeCloseTo(unit, 10)
    expect(flawless - oneMissed).toBeCloseTo(2 * unit, 10)
    expect(oneMissed).toBeLessThan(oneExtra)
  })

  it('ignores duplicate and out of range marks in a response', () => {
    const trial = generateRow(4, createRng(4321))
    const length = trial.payload.length
    const noisy = [...trial.answer, ...trial.answer, -1, length, length + 500, 2.5]

    expect(definition.isCorrect!(trial, noisy)).toBe(true)

    const score = definition.score(
      [
        {
          idx: 0,
          itemType: trial.itemType,
          difficulty: 4,
          params: trial.params,
          response: noisy,
          correct: true,
          rtMs: 10000,
          presentedAt: 0,
        },
      ],
      60,
    )

    expect(score.metrics.treffer).toBe(trial.answer.length)
    expect(score.metrics.auslassungen).toBe(0)
    expect(score.metrics.verwechslungen).toBe(0)
    expect(score.metrics.bearbeitet).toBe(length)
    expect(score.accuracy).toBe(1)
  })

  it('accepts a row only when the marked set equals the target set', () => {
    const trial = generateRow(4, createRng(777))
    expect(definition.isCorrect!(trial, trial.answer)).toBe(true)
    expect(definition.isCorrect!(trial, trial.answer.slice().reverse())).toBe(true)
    expect(definition.isCorrect!(trial, trial.answer.slice(1))).toBe(false)
    expect(definition.isCorrect!(trial, [...trial.answer, ...trial.answer])).toBe(true)

    const extra = trial.payload.findIndex((char) => !isTarget(char))
    expect(definition.isCorrect!(trial, [...trial.answer, extra])).toBe(false)
    expect(definition.isCorrect!(trial, [])).toBe(false)
  })
})
