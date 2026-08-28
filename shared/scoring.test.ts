import { describe, expect, it } from 'vitest'
import {
  accuracyOf,
  buildPersonalNorm,
  clampNote,
  computeNote,
  linearWeight,
  median,
  noteFromPersonalNorm,
  noteFromThresholds,
  standardDeviation,
  weightedThroughput,
} from './scoring'

const thresholds = { raw1: 0, raw4: 20, raw6: 40 }

describe('noteFromThresholds', () => {
  it('anchors the pass mark exactly at raw4', () => {
    expect(noteFromThresholds(20, thresholds)).toBe(4)
  })

  it('clamps below and above', () => {
    expect(noteFromThresholds(-5, thresholds)).toBe(1)
    expect(noteFromThresholds(999, thresholds)).toBe(6)
  })

  it('interpolates linearly in both segments', () => {
    expect(noteFromThresholds(10, thresholds)).toBeCloseTo(2.5, 10)
    expect(noteFromThresholds(30, thresholds)).toBeCloseTo(5, 10)
  })

  it('is monotonically increasing', () => {
    let previous = -Infinity
    for (let raw = -10; raw <= 50; raw += 0.5) {
      const note = noteFromThresholds(raw, thresholds)
      expect(note).toBeGreaterThanOrEqual(previous)
      previous = note
    }
  })

  it('rejects non increasing thresholds', () => {
    expect(() => noteFromThresholds(1, { raw1: 5, raw4: 5, raw6: 9 })).toThrow()
  })
})

describe('statistics helpers', () => {
  it('computes the median for odd and even lengths', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })

  it('returns zero standard deviation for a single value', () => {
    expect(standardDeviation([5])).toBe(0)
  })

  it('computes the sample standard deviation', () => {
    expect(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.13809, 4)
  })
})

describe('personal norm', () => {
  const twentyFive = Array.from({ length: 25 }, (_, i) => 10 + i * 0.5)

  it('stays null below twenty sessions', () => {
    expect(buildPersonalNorm(twentyFive.slice(0, 19), twentyFive.slice(0, 19))).toBeNull()
  })

  it('anchors on the median of the first ten sessions', () => {
    const norm = buildPersonalNorm(twentyFive, twentyFive)
    expect(norm).not.toBeNull()
    expect(norm!.anchorRaw).toBe(median(twentyFive.slice(0, 10)))
  })

  it('maps the anchor exactly to the pass mark', () => {
    const norm = buildPersonalNorm(twentyFive, twentyFive)!
    expect(noteFromPersonalNorm(norm.anchorRaw, norm)).toBe(4)
  })

  it('falls back when the window has no spread', () => {
    const flat = Array.from({ length: 25 }, () => 12)
    expect(buildPersonalNorm(flat, flat)).toBeNull()
  })
})

describe('computeNote', () => {
  it('reports the threshold source when no norm exists', () => {
    const note = computeNote(20, thresholds, null)
    expect(note).toEqual({ value: 4, source: 'thresholds', sampleSize: 0 })
  })

  it('reports the personal source and sample size once a norm exists', () => {
    const history = Array.from({ length: 25 }, (_, i) => 10 + i * 0.5)
    const norm = buildPersonalNorm(history, history)!
    const note = computeNote(norm.anchorRaw, thresholds, norm)
    expect(note.source).toBe('personal')
    expect(note.value).toBe(4)
    expect(note.sampleSize).toBe(history.length)
  })

  it('never leaves the one to six band', () => {
    const history = Array.from({ length: 25 }, (_, i) => 10 + i * 0.5)
    const norm = buildPersonalNorm(history, history)!
    expect(computeNote(-1000, thresholds, norm).value).toBe(1)
    expect(computeNote(1000, thresholds, norm).value).toBe(6)
  })
})

describe('weighted throughput', () => {
  const weight = linearWeight([1, 5], 1, 3)

  it('rewards harder items more than easy ones at equal count', () => {
    const easy = weightedThroughput([{ correct: true, difficulty: 1 }], 60, weight)
    const hard = weightedThroughput([{ correct: true, difficulty: 5 }], 60, weight)
    expect(hard).toBeGreaterThan(easy)
    expect(hard / easy).toBeCloseTo(3, 10)
  })

  it('ignores wrong answers but still spends the clock', () => {
    const results = [
      { correct: true, difficulty: 3 },
      { correct: false, difficulty: 3 },
    ]
    expect(weightedThroughput(results, 60, weight)).toBe(weight(3))
  })

  it('returns zero for a zero length session', () => {
    expect(weightedThroughput([{ correct: true, difficulty: 3 }], 0, weight)).toBe(0)
  })

  it('is the reason adaptivity does not flatten the note', () => {
    const beginner = Array.from({ length: 12 }, () => ({ correct: true, difficulty: 1 }))
      .map((r, i) => ({ ...r, correct: i < 9 }))
    const expert = Array.from({ length: 12 }, () => ({ correct: true, difficulty: 5 }))
      .map((r, i) => ({ ...r, correct: i < 9 }))
    expect(accuracyOf(beginner)).toBe(accuracyOf(expert))
    expect(weightedThroughput(expert, 120, weight)).toBeGreaterThan(
      weightedThroughput(beginner, 120, weight),
    )
  })
})

describe('clampNote', () => {
  it('handles non finite input', () => {
    expect(clampNote(Number.NaN)).toBe(1)
    expect(clampNote(Infinity)).toBe(6)
  })
})
