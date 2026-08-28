import { linearWeight } from '~~/shared/scoring'
import type { GameDefinition, RawScore, TrialResult } from '~~/shared/types'
import {
  generateFacts,
  learnMsFromParams,
  profileCountFromParams,
  responseIndices,
  tallyAnswers,
} from './generator'

const DIFFICULTY_RANGE: [number, number] = [1, 5]
const weight = linearWeight(DIFFICULTY_RANGE, 1, 2)

const definition: GameDefinition = {
  slug: 'faktenlernen',
  name: 'Fakten lernen',
  construct: 'gedaechtnis',
  blurb: 'Steckbriefe einprägen, kurz abgelenkt werden und danach gezielt abrufen, wer was macht.',
  mode: 'block',
  defaultDurationS: 300,
  itemCount: 1,
  difficultyRange: DIFFICULTY_RANGE,
  thresholds: { raw1: 0.3, raw4: 0.65, raw6: 0.92 },
  weight,
  generate: (difficulty, rng) => generateFacts(difficulty, rng),
  isCorrect(trial, response) {
    const expected = Array.isArray(trial.answer) ? (trial.answer as number[]) : []
    if (expected.length === 0) return false
    const given = responseIndices(response, expected.length)
    return expected.every((value, index) => value === given[index])
  },
  score(trials: TrialResult[]): RawScore {
    let korrekt = 0
    let gesamt = 0
    let lernzeitMs = 0
    let profileSum = 0

    for (const trial of trials) {
      const tally = tallyAnswers(trial.params, trial.response)
      korrekt += tally.korrekt
      gesamt += tally.gesamt
      lernzeitMs += learnMsFromParams(trial.params)
      profileSum += profileCountFromParams(trial.params)
    }

    const quote = gesamt > 0 ? korrekt / gesamt : 0

    return {
      raw: quote,
      accuracy: quote,
      metrics: {
        korrekt,
        gesamt,
        quote: Math.round(quote * 1000) / 1000,
        lernzeitMs,
        anzahlProfile: trials.length > 0 ? Math.round(profileSum / trials.length) : 0,
      },
    }
  },
}

export default definition
