import { describe, expect, it } from 'vitest'
import { createRng } from '~~/shared/rng'
import { runGeneratorContract } from '~~/shared/testing/generator-contract'
import { propertyRuns } from '~~/shared/testing/property'
import definition from './definition'
import { ITEM_TYPES, generateArithmetic, type ItemType } from './generator'

describe('kopfrechnen generator', () => {
  it('satisfies the shared generator contract', () => {
    runGeneratorContract(definition, {
      expectIntegerAnswer: true,
      minItemTypes: ITEM_TYPES.length,
      checkTrial: (trial) => {
        expect(trial.payload).toHaveProperty('text')
        expect(String((trial.payload as { text: string }).text).length).toBeGreaterThan(0)
      },
    })
  })

  it('never produces a negative or absurd answer', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const difficulty = (i % 10) + 1
      const trial = generateArithmetic(difficulty, createRng(i + 1))
      expect(trial.answer).toBeGreaterThanOrEqual(0)
      expect(trial.answer).toBeLessThanOrEqual(1_000_000)
      expect(Number.isInteger(trial.answer)).toBe(true)
    }
  })

  it('keeps every percentage between zero and one hundred', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const trial = generateArithmetic((i % 10) + 1, createRng(i * 7919 + 3))
      const params = trial.params as Record<string, number>
      for (const key of ['percent', 'strong', 'weak', 'result']) {
        if (typeof params[key] === 'number' && ['prozentsatz', 'mischung'].includes(trial.itemType)) {
          expect(params[key]).toBeGreaterThanOrEqual(0)
          expect(params[key]).toBeLessThanOrEqual(100)
        }
      }
    }
  })

  it('verifies the arithmetic of every item type independently', () => {
    const runs = propertyRuns()
    const seen = new Set<ItemType>()
    for (let i = 0; i < runs; i++) {
      const trial = generateArithmetic((i % 10) + 1, createRng(i * 104729 + 17))
      const p = trial.params as Record<string, number>
      seen.add(trial.itemType as ItemType)

      switch (trial.itemType) {
        case 'prozentwert':
          expect(trial.answer).toBe((p.percent! * p.base!) / 100)
          break
        case 'prozentsatz':
          expect((p.part! / p.base!) * 100).toBeCloseTo(trial.answer, 10)
          break
        case 'grundwert':
          expect((trial.answer * p.percent!) / 100).toBe(p.part!)
          break
        case 'bruchteil':
          expect(trial.answer).toBe((p.whole! / p.denominator!) * p.numerator!)
          break
        case 'multiplikation':
          expect(trial.answer).toBe(p.a! * p.b!)
          break
        case 'division':
          expect(trial.answer).toBe(p.quotient!)
          break
        case 'dreisatz':
          expect(trial.answer).toBe(p.unitPrice! * p.wanted!)
          expect(p.total! / p.count!).toBe(p.unitPrice!)
          break
        case 'zuschlag':
          expect(trial.answer).toBe(p.base! + p.delta!)
          break
        case 'rabatt':
          expect(trial.answer).toBe(p.base! - p.delta!)
          break
        case 'geschwindigkeit':
          expect(p.speed! * p.hours!).toBe(p.distance!)
          break
        case 'mischung':
          expect((p.a! * p.strong! + p.b! * p.weak!) / (p.a! + p.b!)).toBeCloseTo(trial.answer, 10)
          break
      }
    }
    expect(seen.size).toBe(ITEM_TYPES.length)
  })

  it('gets harder as difficulty rises', () => {
    const magnitude = (difficulty: number) => {
      let total = 0
      for (let i = 0; i < 400; i++) {
        total += generateArithmetic(difficulty, createRng(i * 31 + difficulty)).answer
      }
      return total / 400
    }
    expect(magnitude(9)).toBeGreaterThan(magnitude(2))
  })
})

describe('kopfrechnen scoring', () => {
  const result = (correct: boolean, difficulty: number, rtMs = 3000) => ({
    idx: 0,
    itemType: 'multiplikation',
    difficulty,
    params: {},
    response: 1,
    correct,
    rtMs,
    presentedAt: 0,
  })

  it('rewards the same accuracy at higher difficulty', () => {
    const easy = definition.score(
      [result(true, 1), result(true, 1), result(true, 1), result(false, 1)],
      60,
    )
    const hard = definition.score(
      [result(true, 10), result(true, 10), result(true, 10), result(false, 10)],
      60,
    )
    expect(easy.accuracy).toBe(hard.accuracy)
    expect(hard.raw).toBeGreaterThan(easy.raw)
  })

  it('reports zero for an empty session without throwing', () => {
    const score = definition.score([], 60)
    expect(score.raw).toBe(0)
    expect(score.accuracy).toBe(0)
  })
})
