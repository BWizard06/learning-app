import { linearWeight, weightedThroughput, accuracyOf, median } from '~~/shared/scoring'
import type { GameDefinition, JsonObject, RawScore, TrialResult } from '~~/shared/types'
import { generateSeries } from './generator'

const DIFFICULTY_RANGE: [number, number] = [1, 8]
const weight = linearWeight(DIFFICULTY_RANGE, 1, 3)

function ruleCount(params: JsonObject): number {
  const rules = params.rules
  return Array.isArray(rules) ? rules.length : 0
}

const definition: GameDefinition = {
  slug: 'figurenreihen',
  name: 'Figurenreihen',
  construct: 'logik',
  blurb: 'Die Regel hinter einer Reihe von Figuren erkennen und die nächste Figur bestimmen.',
  mode: 'sprint',
  defaultDurationS: 150,
  difficultyRange: DIFFICULTY_RANGE,
  thresholds: { raw1: 1, raw4: 4, raw6: 9 },
  weight,
  generate: (difficulty, rng) => generateSeries(difficulty, rng),
  score(trials: TrialResult[], durationS: number): RawScore {
    const correct = trials.filter((trial) => trial.correct)
    return {
      raw: weightedThroughput(trials, durationS, weight),
      accuracy: accuracyOf(trials),
      metrics: {
        attempted: trials.length,
        correct: correct.length,
        medianRtMs: correct.length === 0 ? 0 : Math.round(median(correct.map((trial) => trial.rtMs))),
        meanDifficulty:
          trials.length === 0
            ? 0
            : Math.round((trials.reduce((sum, t) => sum + t.difficulty, 0) / trials.length) * 100) / 100,
        meanRules:
          trials.length === 0
            ? 0
            : Math.round((trials.reduce((sum, t) => sum + ruleCount(t.params), 0) / trials.length) * 100) /
              100,
      },
    }
  },
}

export default definition
