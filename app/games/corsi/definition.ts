import { accuracyOf, linearWeight, median } from '~~/shared/scoring'
import type { GameDefinition, JsonValue, RawScore, TrialResult } from '~~/shared/types'
import { generateCorsi, tapList } from './generator'

const DIFFICULTY_RANGE: [number, number] = [2, 9]
const weight = linearWeight(DIFFICULTY_RANGE, 1, 2)

function lengthOf(trial: TrialResult): number {
  const raw = Number(trial.params.length)
  return Number.isFinite(raw) ? raw : 0
}

function directionCode(trials: TrialResult[]): number {
  const first = trials[0]
  return first && first.params.type === 'rueckwaerts' ? 1 : 0
}

const definition: GameDefinition = {
  slug: 'corsi',
  name: 'Corsi-Blöcke',
  construct: 'gedaechtnis',
  blurb: 'Neun Felder leuchten nacheinander auf, tippe die Reihenfolge nach.',
  mode: 'span',
  defaultDurationS: 240,
  difficultyRange: DIFFICULTY_RANGE,
  thresholds: { raw1: 2, raw4: 5, raw6: 8 },
  weight,
  generate: (difficulty, rng) => generateCorsi(difficulty, rng),
  isCorrect(trial, response: JsonValue) {
    const expected = tapList(trial.answer)
    const given = tapList(response)
    if (expected.length === 0) return false
    if (expected.length !== given.length) return false
    return expected.every((value, index) => value === given[index])
  },
  score(trials: TrialResult[]): RawScore {
    const correct = trials.filter((trial) => trial.correct)
    let reached = 0
    for (const trial of correct) {
      const length = lengthOf(trial)
      if (length > reached) reached = length
    }

    return {
      raw: reached,
      accuracy: accuracyOf(trials),
      metrics: {
        spanne: reached,
        richtung: directionCode(trials),
        versuche: trials.length,
        korrekt: correct.length,
        medianRtMs: correct.length === 0 ? 0 : Math.round(median(correct.map((trial) => trial.rtMs))),
      },
    }
  },
}

export default definition
