import { linearWeight, weightedThroughput, accuracyOf, median } from '~~/shared/scoring'
import type { GameDefinition, JsonValue, RawScore, TrialResult } from '~~/shared/types'
import { generateEstimate } from './generator'

const DIFFICULTY_RANGE: [number, number] = [1, 6]
const weight = linearWeight(DIFFICULTY_RANGE, 1, 2)

function chosenKind(result: TrialResult): string {
  const options = result.params.options
  if (!Array.isArray(options)) return 'unbekannt'
  const index = typeof result.response === 'number' ? result.response : Number(result.response)
  if (!Number.isInteger(index)) return 'unbekannt'
  const entry = options[index]
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return 'unbekannt'
  const kind = (entry as { [key: string]: JsonValue }).kind
  return typeof kind === 'string' ? kind : 'unbekannt'
}

const definition: GameDefinition = {
  slug: 'ueberschlag',
  name: 'Überschlag',
  construct: 'rechnen',
  blurb: 'Grössenordnung schätzen statt genau rechnen, fünf Vorschläge, einer stimmt.',
  mode: 'sprint',
  defaultDurationS: 90,
  difficultyRange: DIFFICULTY_RANGE,
  thresholds: { raw1: 4, raw4: 16, raw6: 34 },
  weight,
  generate: (difficulty, rng) => generateEstimate(difficulty, rng),
  score(trials: TrialResult[], durationS: number): RawScore {
    const correct = trials.filter((trial) => trial.correct)

    let zehnerfehler = 0
    let kommafehler = 0
    let knappfehler = 0
    let umkehrfehler = 0

    for (const trial of trials) {
      if (trial.correct) continue
      const kind = chosenKind(trial)
      if (kind === 'faktor-zehn-hoch' || kind === 'faktor-zehn-tief') zehnerfehler++
      else if (kind === 'kommastelle-hoch' || kind === 'kommastelle-tief') kommafehler++
      else if (kind === 'knapp-daneben') knappfehler++
      else if (kind === 'umkehroperation') umkehrfehler++
    }

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
        zehnerfehler,
        kommafehler,
        knappfehler,
        umkehrfehler,
      },
    }
  },
}

export default definition
