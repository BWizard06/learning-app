import { accuracyOf, linearWeight, weightedThroughput } from '~~/shared/scoring'
import type { GameDefinition, JsonValue, RawScore, TrialResult } from '~~/shared/types'
import { generateWortfluss } from './generator'

const DIFFICULTY_RANGE: [number, number] = [1, 3]
const weight = linearWeight(DIFFICULTY_RANGE, 1, 1.6)

const definition: GameDefinition = {
  slug: 'wortfluss',
  name: 'Wortflüssigkeit',
  construct: 'wortfluss',
  blurb: 'Ein Buchstabe oder eine Kategorie, dann so viele Wörter wie möglich in einer Minute.',
  mode: 'sprint',
  defaultDurationS: 60,
  difficultyRange: DIFFICULTY_RANGE,
  thresholds: { raw1: 2, raw4: 11, raw6: 22 },
  weight,
  generate: (difficulty, rng) => generateWortfluss(difficulty, rng),
  isCorrect: (_trial, response: JsonValue) =>
    typeof response === 'string' && response.trim().length > 0,
  score(trials: TrialResult[], durationS: number): RawScore {
    const accepted = trials.filter((trial) => trial.correct)
    const unique = new Set(accepted.map((trial) => String(trial.response).trim().toLowerCase()))
    const meanRtMs =
      accepted.length === 0
        ? 0
        : Math.round(accepted.reduce((sum, trial) => sum + trial.rtMs, 0) / accepted.length)

    return {
      raw: weightedThroughput(trials, durationS, weight),
      accuracy: accuracyOf(trials),
      metrics: {
        accepted: accepted.length,
        rejected: trials.length - accepted.length,
        uniqueCount: unique.size,
        meanRtMs,
      },
    }
  },
}

export default definition
