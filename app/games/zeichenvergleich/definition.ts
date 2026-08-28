import { accuracyOf, linearWeight, median, weightedThroughput } from '~~/shared/scoring'
import type { GameDefinition, RawScore, TrialResult } from '~~/shared/types'
import { generateComparison } from './generator'

const DIFFICULTY_RANGE: [number, number] = [1, 6]
const weight = linearWeight(DIFFICULTY_RANGE, 1, 2)

const definition: GameDefinition = {
  slug: 'zeichenvergleich',
  name: 'Zeichenvergleich',
  construct: 'konzentration',
  blurb: 'Zwei Reihen aus Ziffern und Buchstaben. Gleich oder verschieden, ein einziges Zeichen entscheidet.',
  mode: 'sprint',
  defaultDurationS: 90,
  difficultyRange: DIFFICULTY_RANGE,
  thresholds: { raw1: 8, raw4: 26, raw6: 50 },
  weight,
  generate: (difficulty, rng) => generateComparison(difficulty, rng),
  isCorrect(trial, response) {
    return response === trial.answer
  },
  score(trials: TrialResult[], durationS: number): RawScore {
    const correct = trials.filter((trial) => trial.correct)
    let falschGleich = 0
    let falschVerschieden = 0

    for (const trial of trials) {
      const saidSame = trial.response === true
      const wasSame = trial.params.same === true
      if (saidSame && !wasSame) falschGleich++
      else if (!saidSame && wasSame) falschVerschieden++
    }

    return {
      raw: weightedThroughput(trials, durationS, weight),
      accuracy: accuracyOf(trials),
      metrics: {
        attempted: trials.length,
        correct: correct.length,
        medianRtMs: correct.length === 0 ? 0 : Math.round(median(correct.map((trial) => trial.rtMs))),
        falschGleich,
        falschVerschieden,
      },
    }
  },
}

export default definition
