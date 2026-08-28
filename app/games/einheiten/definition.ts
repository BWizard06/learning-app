import { linearWeight, weightedThroughput, accuracyOf, median } from '~~/shared/scoring'
import type { GameDefinition, RawScore, TrialResult } from '~~/shared/types'
import { generateUmrechnung } from './generator'

const DIFFICULTY_RANGE: [number, number] = [1, 6]
const weight = linearWeight(DIFFICULTY_RANGE, 1, 2)

function meanOf(values: number[]): number {
  if (values.length === 0) return 0
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100
}

const definition: GameDefinition = {
  slug: 'einheiten',
  name: 'Umrechnen',
  construct: 'rechnen',
  blurb: 'Längen, Flächen, Volumen, Zeit, Tempo und Massstab sicher umrechnen.',
  mode: 'sprint',
  defaultDurationS: 120,
  difficultyRange: DIFFICULTY_RANGE,
  thresholds: { raw1: 4, raw4: 15, raw6: 32 },
  weight,
  generate: (difficulty, rng) => generateUmrechnung(difficulty, rng),
  score(trials: TrialResult[], durationS: number): RawScore {
    const correct = trials.filter((trial) => trial.correct)
    const steps: number[] = []
    for (const trial of trials) {
      const value = trial.params.steps
      if (typeof value === 'number') steps.push(value)
    }

    return {
      raw: weightedThroughput(trials, durationS, weight),
      accuracy: accuracyOf(trials),
      metrics: {
        attempted: trials.length,
        correct: correct.length,
        medianRtMs: correct.length === 0 ? 0 : Math.round(median(correct.map((trial) => trial.rtMs))),
        meanDifficulty: meanOf(trials.map((trial) => trial.difficulty)),
        mittlereSchritte: meanOf(steps),
      },
    }
  },
}

export default definition
