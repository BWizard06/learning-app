import { accuracyOf, linearWeight, median, standardDeviation, weightedThroughput } from '~~/shared/scoring'
import type { GameDefinition, JsonValue, RawScore, TrialResult } from '~~/shared/types'
import { generateStimulus } from './generator'

const DIFFICULTY_RANGE: [number, number] = [1, 5]
const weight = linearWeight(DIFFICULTY_RANGE, 1, 1.6)

function isGo(itemType: string): boolean {
  return itemType === 'go'
}

function tapped(response: JsonValue): boolean {
  return response === true
}

const definition: GameDefinition = {
  slug: 'gonogo',
  name: 'Go und No-Go',
  construct: 'konzentration',
  blurb: 'Buchstabe um Buchstabe im Sekundentakt, bei jedem tippen und beim X die Hand stillhalten.',
  mode: 'sprint',
  defaultDurationS: 120,
  difficultyRange: DIFFICULTY_RANGE,
  thresholds: { raw1: 8, raw4: 30, raw6: 55 },
  weight,
  generate: (difficulty, rng) => generateStimulus(difficulty, rng),
  isCorrect(trial, response) {
    return tapped(response) === isGo(trial.itemType)
  },
  score(trials: TrialResult[], durationS: number): RawScore {
    let goTreffer = 0
    let nogoTreffer = 0
    let kommissionsfehler = 0
    let omissionsfehler = 0
    const goZeiten: number[] = []

    for (const trial of trials) {
      const go = isGo(trial.itemType)
      const hit = tapped(trial.response)
      if (go && hit) {
        goTreffer++
        goZeiten.push(trial.rtMs)
      } else if (go) {
        omissionsfehler++
      } else if (hit) {
        kommissionsfehler++
      } else {
        nogoTreffer++
      }
    }

    const judged = trials.map((trial) => ({
      correct: tapped(trial.response) === isGo(trial.itemType),
      difficulty: trial.difficulty,
    }))

    return {
      raw: weightedThroughput(judged, durationS, weight),
      accuracy: accuracyOf(judged),
      metrics: {
        reize: trials.length,
        goTreffer,
        nogoTreffer,
        kommissionsfehler,
        omissionsfehler,
        medianRtMs: goZeiten.length > 0 ? Math.round(median(goZeiten)) : 0,
        rtVariabilitaet:
          goZeiten.length > 0 ? Math.round(standardDeviation(goZeiten) * 10) / 10 : 0,
      },
    }
  },
}

export default definition
