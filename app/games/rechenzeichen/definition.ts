import { linearWeight, weightedThroughput, accuracyOf, median } from '~~/shared/scoring'
import type { GameDefinition, JsonValue, RawScore, TrialResult } from '~~/shared/types'
import { generateRechenzeichen } from './generator'

const DIFFICULTY_RANGE: [number, number] = [1, 6]
const weight = linearWeight(DIFFICULTY_RANGE, 1, 2.4)

function tokens(value: JsonValue | undefined): string[] {
  if (!Array.isArray(value)) return []
  return value.map((entry) => String(entry))
}

function matches(expected: string[], given: string[]): boolean {
  return expected.length === given.length && expected.every((op, i) => op === given[i])
}

const definition: GameDefinition = {
  slug: 'rechenzeichen',
  name: 'Rechenzeichen einsetzen',
  construct: 'rechnen',
  blurb: 'Fehlende Rechenzeichen so setzen, dass die Gleichung aufgeht. Punkt vor Strich.',
  mode: 'sprint',
  defaultDurationS: 120,
  difficultyRange: DIFFICULTY_RANGE,
  thresholds: { raw1: 1.5, raw4: 7, raw6: 15 },
  weight,
  generate: (difficulty, rng) => generateRechenzeichen(difficulty, rng),
  isCorrect(trial, response) {
    return matches(tokens(trial.answer as JsonValue), tokens(response))
  },
  score(trials: TrialResult[], durationS: number): RawScore {
    const correct = trials.filter((trial) => trial.correct)

    let zeichen = 0
    let zeichentreffer = 0
    for (const trial of trials) {
      const expected = tokens(trial.params.ops)
      const given = tokens(trial.response)
      zeichen += expected.length
      for (let i = 0; i < expected.length; i++) {
        if (expected[i] === given[i]) zeichentreffer++
      }
    }

    return {
      raw: weightedThroughput(trials, durationS, weight),
      accuracy: accuracyOf(trials),
      metrics: {
        attempted: trials.length,
        correct: correct.length,
        zeichen,
        zeichentreffer,
        medianRtMs: correct.length === 0 ? 0 : Math.round(median(correct.map((trial) => trial.rtMs))),
        meanDifficulty:
          trials.length === 0
            ? 0
            : Math.round((trials.reduce((sum, t) => sum + t.difficulty, 0) / trials.length) * 100) /
              100,
      },
    }
  },
}

export default definition
