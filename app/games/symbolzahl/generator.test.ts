import { describe, expect, it } from 'vitest'
import { createRng } from '~~/shared/rng'
import { runGeneratorContract } from '~~/shared/testing/generator-contract'
import { propertyRuns } from '~~/shared/testing/property'
import definition from './definition'
import {
  CONFUSABILITY,
  DIGITS,
  ITEM_TYPES,
  LEGEND_SHUFFLE_FROM,
  SYMBOL_IDS,
  generateSymbolzahl,
  legendForSeed,
  legendOrderForSeed,
  symbolToSvg,
  type SymbolId,
  type SymbolzahlPayload,
} from './generator'

const ASCENDING = [1, 2, 3, 4, 5, 6, 7, 8, 9]

function legendOf(trial: { params: Record<string, unknown> }): number[] {
  return trial.params.legend as number[]
}

function payloadOf(trial: { payload: unknown }): SymbolzahlPayload {
  return trial.payload as SymbolzahlPayload
}

function mappingOf(payload: SymbolzahlPayload): Record<string, number> {
  const mapping: Record<string, number> = {}
  for (const entry of payload.legend) mapping[entry.id] = entry.digit
  return mapping
}

describe('symbolzahl symbols', () => {
  it('renders nine distinct glyphs that inherit the current colour', () => {
    const drawings = SYMBOL_IDS.map((id) => symbolToSvg(id))
    expect(new Set(drawings).size).toBe(SYMBOL_IDS.length)
    for (const drawing of drawings) {
      expect(drawing.startsWith('<svg ')).toBe(true)
      expect(drawing.endsWith('</svg>')).toBe(true)
      expect(drawing).toContain('currentColor')
      expect(drawing).toContain('viewBox="0 0 24 24"')
      expect(drawing.length).toBeGreaterThan(60)
    }
  })

  it('is a pure renderer', () => {
    for (const id of SYMBOL_IDS) {
      expect(symbolToSvg(id)).toBe(symbolToSvg(id))
      expect(CONFUSABILITY[id]).toBeGreaterThan(0)
      expect(CONFUSABILITY[id]).toBeLessThanOrEqual(1)
    }
  })

  it('rejects an unknown symbol', () => {
    expect(() => symbolToSvg('kein-zeichen' as SymbolId)).toThrow(RangeError)
  })
})

describe('symbolzahl generator', () => {
  it('satisfies the shared generator contract', () => {
    runGeneratorContract(definition, {
      expectIntegerAnswer: true,
      answerRange: [1, 9],
      minItemTypes: ITEM_TYPES.length,
      checkTrial: (trial) => {
        const payload = payloadOf(trial)
        expect(payload.legend).toHaveLength(SYMBOL_IDS.length)
        expect(payload.symbolSvg).toBe(symbolToSvg(payload.symbolId))
        expect(SYMBOL_IDS).toContain(payload.symbolId)
        const match = payload.legend.find((entry) => entry.id === payload.symbolId)
        expect(match?.digit).toBe(trial.answer)
      },
    })
  })

  it('keeps the legend identical for every trial inside one session', () => {
    const runs = Math.min(propertyRuns(), 2500)
    for (const seed of [0, 1, 7, 4242, 99991, 2654435761]) {
      const rng = createRng(seed)
      const firstTrial = generateSymbolzahl(1, rng)
      const firstLegend = legendOf(firstTrial)
      const firstMapping = mappingOf(payloadOf(firstTrial))

      for (let i = 0; i < runs; i++) {
        const trial = generateSymbolzahl((i % 4) + 1, rng)
        expect(legendOf(trial)).toEqual(firstLegend)
        expect(mappingOf(payloadOf(trial))).toEqual(firstMapping)
      }
    }
  })

  it('derives the legend from the seed and never from the advancing stream', () => {
    for (const seed of [3, 55, 123456, 987654321]) {
      const expected = legendForSeed(seed)
      const rng = createRng(seed)
      for (let i = 0; i < 200; i++) {
        expect(legendOf(generateSymbolzahl((i % 4) + 1, rng))).toEqual(expected)
      }
      expect(legendForSeed(seed)).toEqual(expected)
    }
  })

  it('always builds a true permutation of one to nine', () => {
    const runs = Math.min(propertyRuns(), 3000)
    for (let i = 0; i < runs; i++) {
      const seed = i * 2654435761 + 1
      const legend = legendForSeed(seed)
      expect(legend).toHaveLength(SYMBOL_IDS.length)
      expect(legend.slice().sort((a, b) => a - b)).toEqual(ASCENDING)

      const payload = payloadOf(generateSymbolzahl((i % 4) + 1, createRng(seed)))
      expect(payload.legend.map((entry) => entry.digit).sort((a, b) => a - b)).toEqual(ASCENDING)
      expect(new Set(payload.legend.map((entry) => entry.id)).size).toBe(SYMBOL_IDS.length)
    }
  })

  it('answers with the digit the legend assigns to the shown symbol', () => {
    const runs = Math.min(propertyRuns(), 4000)
    for (let i = 0; i < runs; i++) {
      const seed = i * 40503 + 11
      const rng = createRng(seed)
      const legend = legendForSeed(seed)
      for (let trialIndex = 0; trialIndex < 4; trialIndex++) {
        const trial = generateSymbolzahl((trialIndex % 4) + 1, rng)
        const payload = payloadOf(trial)
        const position = SYMBOL_IDS.indexOf(payload.symbolId)
        expect(position).toBeGreaterThanOrEqual(0)
        expect(trial.answer).toBe(legend[position])
        expect(trial.params.digit).toBe(trial.answer)
        expect(trial.params.symbol).toBe(payload.symbolId)
        expect(DIGITS).toContain(trial.answer)
      }
    }
  })

  it('gives different seeds different legends often enough', () => {
    const seeds = 800
    const seen = new Set<string>()
    for (let i = 0; i < seeds; i++) {
      seen.add(legendForSeed(i * 2654435761 + 17).join(''))
    }
    expect(seen.size).toBeGreaterThan(seeds * 0.95)

    let differing = 0
    for (let i = 0; i < seeds; i++) {
      const a = legendForSeed(i * 7919 + 3)
      const b = legendForSeed(i * 7919 + 4)
      if (a.join('') !== b.join('')) differing++
    }
    expect(differing).toBe(seeds)
  })

  it('spreads the expected digit evenly across seeds', () => {
    const runs = 4500
    const counts = new Array(10).fill(0)
    for (let i = 0; i < runs; i++) {
      const trial = generateSymbolzahl((i % 4) + 1, createRng(i * 2654435761 + 5))
      counts[trial.answer as number]++
    }
    expect(counts[0]).toBe(0)
    for (const digit of DIGITS) {
      expect(counts[digit]).toBeGreaterThan((runs / 9) * 0.6)
      expect(counts[digit]).toBeLessThan((runs / 9) * 1.4)
    }
  })
})

describe('symbolzahl difficulty', () => {
  it('shows the legend in digit order while it is easy and scrambles it later', () => {
    for (let i = 0; i < 300; i++) {
      const seed = i * 2654435761 + 9
      const digitOrder = legendOrderForSeed(seed, 1)

      for (const difficulty of [1, 2]) {
        const payload = payloadOf(generateSymbolzahl(difficulty, createRng(seed)))
        expect(payload.legendShuffled).toBe(false)
        expect(payload.legend.map((entry) => entry.digit)).toEqual(ASCENDING)
      }

      for (const difficulty of [3, 4]) {
        const payload = payloadOf(generateSymbolzahl(difficulty, createRng(seed)))
        expect(payload.legendShuffled).toBe(true)
        expect(payload.legend.map((entry) => entry.digit)).not.toEqual(ASCENDING)
        const order = legendOrderForSeed(seed, difficulty)
        expect(order.slice().sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
        expect(order).not.toEqual(digitOrder)
      }
    }
  })

  it('never lets difficulty touch the mapping of symbol to digit', () => {
    for (let i = 0; i < 400; i++) {
      const seed = i * 104729 + 13
      const reference = mappingOf(payloadOf(generateSymbolzahl(1, createRng(seed))))
      for (const difficulty of [2, 3, 4]) {
        expect(mappingOf(payloadOf(generateSymbolzahl(difficulty, createRng(seed))))).toEqual(reference)
      }
      expect(Object.keys(reference).sort()).toEqual(SYMBOL_IDS.slice().sort())
    }
  })

  it('probes more confusable symbols as difficulty rises', () => {
    const meanConfusability = (difficulty: number) => {
      let total = 0
      let count = 0
      for (let s = 0; s < 60; s++) {
        const rng = createRng(s * 7919 + 101)
        for (let i = 0; i < 60; i++) {
          const trial = generateSymbolzahl(difficulty, rng)
          total += CONFUSABILITY[trial.params.symbol as SymbolId]!
          count++
        }
      }
      return total / count
    }

    const means = [1, 2, 3, 4].map(meanConfusability)
    for (let i = 1; i < means.length; i++) {
      expect(means[i]!).toBeGreaterThan(means[i - 1]!)
    }
    expect(means[3]! - means[0]!).toBeGreaterThan(0.1)
  })

  it('keeps every symbol reachable at every difficulty', () => {
    for (const difficulty of [1, 2, 3, 4]) {
      const seen = new Set<string>()
      const rng = createRng(difficulty * 31 + 7)
      for (let i = 0; i < 4000; i++) {
        seen.add(generateSymbolzahl(difficulty, rng).params.symbol as string)
      }
      expect(seen.size).toBe(SYMBOL_IDS.length)
    }
  })

  it('flips the legend order exactly at the documented step', () => {
    expect(LEGEND_SHUFFLE_FROM).toBe(3)
    const seed = 20260828
    expect(payloadOf(generateSymbolzahl(LEGEND_SHUFFLE_FROM - 1, createRng(seed))).legendShuffled).toBe(false)
    expect(payloadOf(generateSymbolzahl(LEGEND_SHUFFLE_FROM, createRng(seed))).legendShuffled).toBe(true)
  })
})

describe('symbolzahl scoring', () => {
  const result = (correct: boolean, difficulty: number, rtMs = 1200) => ({
    idx: 0,
    itemType: 'symbolzahl',
    difficulty,
    params: {},
    response: 1,
    correct,
    rtMs,
    presentedAt: 0,
  })

  it('rewards the same accuracy at higher difficulty', () => {
    const easy = definition.score([result(true, 1), result(true, 1), result(false, 1)], 60)
    const hard = definition.score([result(true, 4), result(true, 4), result(false, 4)], 60)
    expect(easy.accuracy).toBe(hard.accuracy)
    expect(hard.raw).toBeGreaterThan(easy.raw)
  })

  it('counts correct assignments per minute', () => {
    const trials = [result(true, 1), result(true, 1), result(true, 1), result(false, 1)]
    expect(definition.score(trials, 60).raw).toBeCloseTo(3, 10)
    expect(definition.score(trials, 30).raw).toBeCloseTo(6, 10)
  })

  it('reports the response times of the correct assignments', () => {
    const score = definition.score(
      [result(true, 2, 900), result(true, 2, 1100), result(true, 2, 2500), result(false, 2, 9000)],
      90,
    )
    expect(score.metrics.attempted).toBe(4)
    expect(score.metrics.correct).toBe(3)
    expect(score.metrics.medianRtMs).toBe(1100)
    expect(score.metrics.meanRtMs).toBe(1500)
  })

  it('reports zero for an empty session without throwing', () => {
    const score = definition.score([], 90)
    expect(score.raw).toBe(0)
    expect(score.accuracy).toBe(0)
    expect(score.metrics.medianRtMs).toBe(0)
    expect(score.metrics.meanRtMs).toBe(0)
  })
})
