import { expect } from 'vitest'
import { createRng } from '../rng'
import { isTrialBlock, type GameDefinition, type Trial } from '../types'
import { propertyRuns } from './property'

export interface GeneratorContractOptions {
  runs?: number
  difficulties?: number[]
  expectIntegerAnswer?: boolean
  answerRange?: [number, number]
  maxPositionShare?: number
  minItemTypes?: number
  checkTrial?: (trial: Trial, difficulty: number) => void
}

function collectTrials(generated: unknown): Trial[] {
  if (isTrialBlock(generated)) return generated.trials
  return [generated as Trial]
}

function difficultiesFor(definition: GameDefinition, provided?: number[]): number[] {
  if (provided && provided.length > 0) return provided
  const [lo, hi] = definition.difficultyRange
  const steps: number[] = []
  for (let d = lo; d <= hi; d++) steps.push(d)
  return steps.length > 0 ? steps : [lo]
}

export function runGeneratorContract(
  definition: GameDefinition,
  options: GeneratorContractOptions = {},
): void {
  const runs = options.runs ?? propertyRuns()
  const difficulties = difficultiesFor(definition, options.difficulties)
  const maxPositionShare = options.maxPositionShare ?? 0.45

  const positionCounts = new Map<number, number>()
  const itemTypes = new Set<string>()
  let choiceTrials = 0

  for (let run = 0; run < runs; run++) {
    const difficulty = difficulties[run % difficulties.length]!
    const seed = run * 2654435761 + 1

    const first = definition.generate(difficulty, createRng(seed))
    const second = definition.generate(difficulty, createRng(seed))
    expect(JSON.stringify(first), `seed ${seed} is not deterministic`).toBe(JSON.stringify(second))

    for (const trial of collectTrials(first)) {
      itemTypes.add(trial.itemType)

      expect(typeof trial.itemType, 'itemType must be a string').toBe('string')
      expect(trial.itemType.length, 'itemType must not be empty').toBeGreaterThan(0)

      expect(trial.difficulty).toBeGreaterThanOrEqual(definition.difficultyRange[0])
      expect(trial.difficulty).toBeLessThanOrEqual(definition.difficultyRange[1])

      const serialised = JSON.stringify(trial.params)
      expect(serialised, 'params must be JSON serialisable').toBeTypeOf('string')
      expect(JSON.parse(serialised)).toEqual(trial.params)

      expect(trial.answer, 'answer must be defined').not.toBeUndefined()

      if (options.expectIntegerAnswer) {
        const numeric = typeof trial.answer === 'number' ? trial.answer : Number(trial.answer)
        expect(Number.isInteger(numeric), `answer ${trial.answer} must be an integer`).toBe(true)
      }

      if (options.answerRange) {
        const numeric = typeof trial.answer === 'number' ? trial.answer : Number(trial.answer)
        expect(numeric).toBeGreaterThanOrEqual(options.answerRange[0])
        expect(numeric).toBeLessThanOrEqual(options.answerRange[1])
      }

      if (trial.options) {
        choiceTrials++
        expect(trial.options.length, 'need at least two options').toBeGreaterThanOrEqual(2)

        const labels = trial.options.map((option) => option.svg ?? option.label)
        expect(new Set(labels).size, `duplicate options: ${labels.join(' | ')}`).toBe(labels.length)

        const ids = trial.options.map((option) => option.id)
        expect(new Set(ids).size, 'duplicate option ids').toBe(ids.length)

        expect(trial.correctIndex, 'correctIndex required with options').toBeTypeOf('number')
        expect(trial.correctIndex!).toBeGreaterThanOrEqual(0)
        expect(trial.correctIndex!).toBeLessThan(trial.options.length)

        const key = trial.correctIndex!
        positionCounts.set(key, (positionCounts.get(key) ?? 0) + 1)
      }

      options.checkTrial?.(trial, difficulty)
    }
  }

  if (choiceTrials > 0) {
    for (const [position, count] of positionCounts) {
      const share = count / choiceTrials
      expect(
        share,
        `correct answer sits at position ${position} in ${(share * 100).toFixed(1)}% of items`,
      ).toBeLessThanOrEqual(maxPositionShare)
    }
  }

  if (options.minItemTypes) {
    expect(
      itemTypes.size,
      `expected at least ${options.minItemTypes} item types, saw ${[...itemTypes].join(', ')}`,
    ).toBeGreaterThanOrEqual(options.minItemTypes)
  }
}

export function expectNoDuplicateOptionValues(values: readonly unknown[]): void {
  const serialised = values.map((value) => JSON.stringify(value))
  expect(new Set(serialised).size).toBe(serialised.length)
}
