import { linearWeight, median } from '~~/shared/scoring'
import type { GameDefinition, RawScore, TrialResult } from '~~/shared/types'
import {
  channelsFromParams,
  generateStream,
  matchesFromParams,
  readResponse,
  rtOf,
} from './generator'

const DIFFICULTY_RANGE: [number, number] = [1, 4]
const weight = linearWeight(DIFFICULTY_RANGE, 1, 2.5)

const definition: GameDefinition = {
  slug: 'nback',
  name: 'N-Back',
  construct: 'gedaechtnis',
  blurb: 'Reiz um Reiz im Takt, tippen sobald er gleich ist wie ein paar Schritte vorher.',
  mode: 'sprint',
  defaultDurationS: 120,
  difficultyRange: DIFFICULTY_RANGE,
  thresholds: { raw1: 4, raw4: 16, raw6: 34 },
  weight,
  generate: (difficulty, rng) => generateStream(difficulty, rng),
  isCorrect(trial, response) {
    const expected = matchesFromParams(trial.params)
    const given = readResponse(response)
    return channelsFromParams(trial.params).every((channel) => expected[channel] === given[channel])
  },
  score(trials: TrialResult[], durationS: number): RawScore {
    let treffer = 0
    let falscheAlarme = 0
    let verpasst = 0
    let gewichtet = 0
    let stufenSumme = 0
    const zeiten: number[] = []

    for (const trial of trials) {
      const expected = matchesFromParams(trial.params)
      const given = readResponse(trial.response)
      let netto = 0

      for (const channel of channelsFromParams(trial.params)) {
        if (expected[channel] && given[channel]) {
          treffer++
          netto++
          const rt = rtOf(given, channel)
          if (rt > 0) zeiten.push(rt)
        } else if (expected[channel]) {
          verpasst++
        } else if (given[channel]) {
          falscheAlarme++
          netto--
        }
      }

      gewichtet += weight(trial.difficulty) * netto
      stufenSumme += trial.difficulty
    }

    const minutes = durationS > 0 ? durationS / 60 : 0
    const entscheidungen = treffer + falscheAlarme + verpasst

    return {
      raw: minutes > 0 ? Math.max(0, gewichtet / minutes) : 0,
      accuracy: entscheidungen > 0 ? treffer / entscheidungen : 0,
      metrics: {
        treffer,
        falscheAlarme,
        verpasst,
        medianRtMs: zeiten.length > 0 ? Math.round(median(zeiten)) : 0,
        nLevel: trials.length > 0 ? Math.round(stufenSumme / trials.length) : 0,
      },
    }
  },
}

export default definition
