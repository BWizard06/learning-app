import { describe, expect, it } from 'vitest'
import { createRng } from '~~/shared/rng'
import { runGeneratorContract } from '~~/shared/testing/generator-contract'
import { propertyRuns } from '~~/shared/testing/property'
import type { JsonValue, Trial, TrialResult } from '~~/shared/types'
import definition from './definition'
import {
  GO_SHARE,
  ITEM_TYPES,
  NOGO_LETTER,
  RULE_TEXT,
  generateStimulus,
  letterSvg,
  schraegShareFor,
  windowMsFor,
  type GoNoGoPayload,
  type GoNoGoTrial,
} from './generator'

const DIFFICULTIES = [1, 2, 3, 4, 5]

const HAND_DRAWN_PATHS: Record<string, string> = {
  X: 'M28 18L72 82M72 18L28 82',
  T: 'M28 18L72 18M50 18L50 82',
  L: 'M28 18L28 82M28 82L70 82',
  V: 'M28 18L50 82M50 82L72 18',
  A: 'M28 82L50 18M50 18L72 82M36.6 57L63.4 57',
}

const HAND_WRITTEN_WINDOWS: Record<number, number> = { 1: 900, 2: 800, 3: 700, 4: 600, 5: 500 }

const ALL_GO_LETTERS = ['A', 'E', 'F', 'H', 'I', 'K', 'L', 'M', 'N', 'T', 'V', 'W', 'Y', 'Z']

function pathOf(svg: string): string {
  const match = /<path d="([^"]*)"/.exec(svg)
  expect(match, `no path in ${svg}`).not.toBeNull()
  return match![1]!
}

function segmentsOf(svg: string): [number, number, number, number][] {
  const points = pathOf(svg)
    .split(/[ML]/)
    .filter((chunk) => chunk.trim().length > 0)
    .map((chunk) => {
      const [x, y] = chunk.trim().split(/\s+/).map(Number)
      return [x!, y!] as [number, number]
    })
  const out: [number, number, number, number][] = []
  for (let i = 0; i + 1 < points.length; i += 2) {
    out.push([points[i]![0], points[i]![1], points[i + 1]![0], points[i + 1]![1]])
  }
  return out
}

function hasSchraegeKante(svg: string): boolean {
  return segmentsOf(svg).some(([x1, y1, x2, y2]) => x1 !== x2 && y1 !== y2)
}

function payloadOf(trial: GoNoGoTrial): GoNoGoPayload {
  return trial.payload
}

function stream(difficulty: number, seed: number, count: number): GoNoGoTrial[] {
  const rng = createRng(seed)
  const out: GoNoGoTrial[] = []
  for (let i = 0; i < count; i++) out.push(generateStimulus(difficulty, rng))
  return out
}

describe('gonogo generator', () => {
  it('satisfies the shared generator contract', () => {
    runGeneratorContract(definition, {
      minItemTypes: ITEM_TYPES.length,
      checkTrial: (trial) => {
        const payload = trial.payload as GoNoGoPayload
        expect(['go', 'nogo']).toContain(trial.itemType)
        expect(payload.letter.length).toBe(1)
        expect(payload.svg.startsWith('<svg')).toBe(true)
        expect(payload.rule).toBe(RULE_TEXT)
        expect(typeof payload.windowMs).toBe('number')
      },
    })
  })

  it('draws the no-go letter exactly as the hand drawn reference', () => {
    for (const [letter, path] of Object.entries(HAND_DRAWN_PATHS)) {
      expect(pathOf(letterSvg(letter)), `glyph ${letter}`).toBe(path)
    }
    expect(letterSvg(NOGO_LETTER)).toContain('<title>Buchstabe X</title>')
  })

  it('shows the X picture on no-go items and never on go items', () => {
    const runs = propertyRuns()
    const nogoPath = HAND_DRAWN_PATHS.X!
    for (let i = 0; i < runs; i++) {
      const difficulty = DIFFICULTIES[i % DIFFICULTIES.length]!
      const trial = generateStimulus(difficulty, createRng(i * 2654435761 + 1))
      const payload = payloadOf(trial)
      const drawsX = pathOf(payload.svg) === nogoPath
      expect(drawsX).toBe(trial.itemType === 'nogo')
      expect(payload.letter === NOGO_LETTER).toBe(trial.itemType === 'nogo')
      expect(payload.go).toBe(trial.itemType === 'go')
      expect(trial.answer).toBe(trial.itemType === 'go' ? true : null)
    }
  })

  it('maps every letter to one picture and only X to no-go', () => {
    const runs = propertyRuns()
    const pictureOf = new Map<string, string>()
    const typesOf = new Map<string, Set<string>>()
    for (let i = 0; i < runs; i++) {
      const difficulty = DIFFICULTIES[i % DIFFICULTIES.length]!
      const trial = generateStimulus(difficulty, createRng(i * 104729 + 17))
      const payload = payloadOf(trial)
      const known = pictureOf.get(payload.letter)
      if (known === undefined) pictureOf.set(payload.letter, payload.svg)
      else expect(payload.svg).toBe(known)
      const types = typesOf.get(payload.letter) ?? new Set<string>()
      types.add(trial.itemType)
      typesOf.set(payload.letter, types)

      for (const [x1, y1, x2, y2] of segmentsOf(payload.svg)) {
        for (const value of [x1, y1, x2, y2]) {
          expect(value).toBeGreaterThanOrEqual(0)
          expect(value).toBeLessThanOrEqual(100)
        }
        expect(x1 === x2 && y1 === y2).toBe(false)
      }
      expect(segmentsOf(payload.svg).length).toBeGreaterThanOrEqual(2)
    }

    const letters = [...pictureOf.keys()].sort()
    expect(letters).toEqual([...ALL_GO_LETTERS, NOGO_LETTER].sort())
    expect(new Set(pictureOf.values()).size).toBe(letters.length)

    const nogoLetters = letters.filter((letter) => typesOf.get(letter)!.has('nogo'))
    expect(nogoLetters).toEqual([NOGO_LETTER])
    for (const letter of letters) {
      expect(typesOf.get(letter)!.size, `letter ${letter} carries two roles`).toBe(1)
    }
  })

  it('keeps the go share between seventy and eighty percent at every difficulty', () => {
    expect(GO_SHARE).toBe(0.75)
    const runs = Math.max(2000, propertyRuns())
    let goTotal = 0
    let total = 0
    for (const difficulty of DIFFICULTIES) {
      const trials = stream(difficulty, difficulty * 2654435761 + 3, runs)
      const go = trials.filter((trial) => trial.itemType === 'go').length
      const share = go / runs
      expect(share, `go share at difficulty ${difficulty}`).toBeGreaterThanOrEqual(0.7)
      expect(share, `go share at difficulty ${difficulty}`).toBeLessThanOrEqual(0.8)
      goTotal += go
      total += runs
    }
    expect(goTotal / total).toBeGreaterThanOrEqual(0.7)
    expect(goTotal / total).toBeLessThanOrEqual(0.8)
  })

  it('offers both item types and both letter shapes at every difficulty', () => {
    for (const difficulty of DIFFICULTIES) {
      const trials = stream(difficulty, difficulty * 7919 + 11, 6000)
      const types = new Set(trials.map((trial) => trial.itemType))
      expect([...types].sort(), `difficulty ${difficulty}`).toEqual(['go', 'nogo'])

      const goLetters = new Set<string>()
      let gerade = 0
      let schraeg = 0
      for (const trial of trials) {
        if (trial.itemType !== 'go') continue
        const payload = payloadOf(trial)
        goLetters.add(payload.letter)
        if (hasSchraegeKante(payload.svg)) schraeg++
        else gerade++
      }
      expect(gerade, `no straight go letter at difficulty ${difficulty}`).toBeGreaterThan(0)
      expect(schraeg, `no slanted go letter at difficulty ${difficulty}`).toBeGreaterThan(0)
      expect([...goLetters].sort(), `go alphabet at difficulty ${difficulty}`).toEqual(ALL_GO_LETTERS)
    }
  })

  it('shows every single go letter already at the lowest difficulty', () => {
    const trials = stream(1, 4242, 8000)
    const seen = new Set<string>()
    for (const trial of trials) {
      if (trial.itemType === 'go') seen.add(payloadOf(trial).letter)
    }
    expect([...seen].sort()).toEqual(ALL_GO_LETTERS)
  })

  it('shortens the presentation window step by step', () => {
    for (const difficulty of DIFFICULTIES) {
      expect(windowMsFor(difficulty)).toBe(HAND_WRITTEN_WINDOWS[difficulty])
    }
    for (let d = 2; d <= 5; d++) {
      expect(windowMsFor(d)).toBeLessThan(windowMsFor(d - 1))
    }
    expect(windowMsFor(0.4)).toBe(900)
    expect(windowMsFor(9)).toBe(500)

    const runs = Math.min(propertyRuns(), 3000)
    for (let i = 0; i < runs; i++) {
      const difficulty = DIFFICULTIES[i % DIFFICULTIES.length]!
      const trial = generateStimulus(difficulty, createRng(i * 15485863 + 5))
      expect(payloadOf(trial).windowMs).toBe(HAND_WRITTEN_WINDOWS[difficulty])
      expect(trial.params.windowMs).toBe(HAND_WRITTEN_WINDOWS[difficulty])
    }
  })

  it('raises the share of slanted go letters with difficulty', () => {
    const shares = DIFFICULTIES.map((difficulty) => {
      const trials = stream(difficulty, difficulty * 32452843 + 7, 8000)
      let go = 0
      let schraeg = 0
      for (const trial of trials) {
        if (trial.itemType !== 'go') continue
        go++
        if (hasSchraegeKante(payloadOf(trial).svg)) schraeg++
      }
      return schraeg / go
    })

    for (let i = 1; i < shares.length; i++) {
      expect(shares[i]!, `difficulty ${DIFFICULTIES[i]}`).toBeGreaterThan(shares[i - 1]!)
    }
    for (const share of shares) {
      expect(share).toBeGreaterThan(0.02)
      expect(share).toBeLessThan(0.98)
    }
    expect(schraegShareFor(5)).toBeGreaterThan(schraegShareFor(1))
  })

  it('always draws the no-go letter with slanted strokes', () => {
    const runs = Math.min(propertyRuns(), 3000)
    for (let i = 0; i < runs; i++) {
      const trial = generateStimulus(DIFFICULTIES[i % DIFFICULTIES.length]!, createRng(i * 99991 + 13))
      if (trial.itemType !== 'nogo') continue
      expect(hasSchraegeKante(payloadOf(trial).svg)).toBe(true)
    }
    expect(hasSchraegeKante(letterSvg(NOGO_LETTER))).toBe(true)
  })

  it('keeps prose out of params and mirrors the payload', () => {
    const runs = Math.min(propertyRuns(), 3000)
    for (let i = 0; i < runs; i++) {
      const difficulty = DIFFICULTIES[i % DIFFICULTIES.length]!
      const trial = generateStimulus(difficulty, createRng(i * 2246822519 + 19))
      const payload = payloadOf(trial)
      const serialised = JSON.stringify(trial.params)
      expect(serialised).not.toContain(RULE_TEXT)
      expect(serialised).not.toContain('<svg')
      expect(trial.params.type).toBe(trial.itemType)
      expect(trial.params.letter).toBe(payload.letter)
      expect(trial.params.go).toBe(payload.go)
      expect(letterSvg(String(trial.params.letter))).toBe(payload.svg)
    }
  })

  it('produces the same stimulus twice for the same seed', () => {
    for (const difficulty of DIFFICULTIES) {
      const a = generateStimulus(difficulty, createRng(20260828))
      const b = generateStimulus(difficulty, createRng(20260828))
      expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    }
  })
})

describe('gonogo correctness', () => {
  const goTrial = { itemType: 'go', difficulty: 1, params: {}, payload: {}, answer: true } as Trial
  const nogoTrial = { itemType: 'nogo', difficulty: 1, params: {}, payload: {}, answer: null } as Trial

  it('accepts a tap on go and silence on no-go', () => {
    expect(definition.isCorrect!(goTrial, true)).toBe(true)
    expect(definition.isCorrect!(goTrial, null)).toBe(false)
    expect(definition.isCorrect!(goTrial, false)).toBe(false)
    expect(definition.isCorrect!(nogoTrial, true)).toBe(false)
    expect(definition.isCorrect!(nogoTrial, null)).toBe(true)
    expect(definition.isCorrect!(nogoTrial, false)).toBe(true)
  })

  it('agrees with the generated item type on every trial', () => {
    const runs = Math.min(propertyRuns(), 3000)
    for (let i = 0; i < runs; i++) {
      const trial = generateStimulus(DIFFICULTIES[i % DIFFICULTIES.length]!, createRng(i * 40503 + 23))
      expect(definition.isCorrect!(trial, true)).toBe(trial.itemType === 'go')
      expect(definition.isCorrect!(trial, null)).toBe(trial.itemType === 'nogo')
    }
  })
})

describe('gonogo scoring', () => {
  function result(
    itemType: 'go' | 'nogo',
    response: JsonValue,
    rtMs: number,
    difficulty = 1,
  ): TrialResult {
    return {
      idx: 0,
      itemType,
      difficulty,
      params: { type: itemType },
      response,
      correct: false,
      rtMs,
      presentedAt: 0,
    }
  }

  function session(difficulty = 1): TrialResult[] {
    return [
      result('go', true, 400, difficulty),
      result('go', true, 400, difficulty),
      result('go', true, 500, difficulty),
      result('go', true, 600, difficulty),
      result('go', true, 600, difficulty),
      result('go', null, 900, difficulty),
      result('go', null, 900, difficulty),
      result('nogo', true, 300, difficulty),
      result('nogo', null, 700, difficulty),
      result('nogo', null, 700, difficulty),
    ]
  }

  it('counts commissions, omissions and hits from hand written trials', () => {
    const score = definition.score(session(), 60)
    expect(score.metrics.reize).toBe(10)
    expect(score.metrics.goTreffer).toBe(5)
    expect(score.metrics.nogoTreffer).toBe(2)
    expect(score.metrics.kommissionsfehler).toBe(1)
    expect(score.metrics.omissionsfehler).toBe(2)
    expect(score.accuracy).toBeCloseTo(0.7, 10)
  })

  it('reports the median and the spread of the go reaction times', () => {
    const score = definition.score(session(), 60)
    expect(score.metrics.medianRtMs).toBe(500)
    expect(score.metrics.rtVariabilitaet).toBe(100)
  })

  it('reports a spread that is not a whole number', () => {
    const score = definition.score(
      [result('go', true, 300), result('go', true, 500), result('nogo', null, 700)],
      60,
    )
    expect(score.metrics.medianRtMs).toBe(400)
    expect(score.metrics.rtVariabilitaet).toBe(141.4)
  })

  it('ignores the stored correct flag and judges the response itself', () => {
    const flipped = session().map((entry) => ({ ...entry, correct: true }))
    const honest = definition.score(session(), 60)
    const noisy = definition.score(flipped, 60)
    expect(noisy.accuracy).toBe(honest.accuracy)
    expect(noisy.raw).toBe(honest.raw)
  })

  it('turns seven correct responses per minute into the raw value', () => {
    expect(definition.score(session(1), 60).raw).toBeCloseTo(7, 10)
    expect(definition.score(session(5), 120).raw).toBeCloseTo(5.6, 10)
    expect(definition.score(session(5), 60).raw).toBeCloseTo(11.2, 10)
  })

  it('leaves the reaction time metrics at zero without a single go hit', () => {
    const score = definition.score([result('nogo', null, 700), result('go', null, 900)], 60)
    expect(score.metrics.medianRtMs).toBe(0)
    expect(score.metrics.rtVariabilitaet).toBe(0)
    expect(score.metrics.omissionsfehler).toBe(1)
    expect(score.metrics.nogoTreffer).toBe(1)
    expect(score.accuracy).toBeCloseTo(0.5, 10)
  })

  it('reports a zero spread for a single go hit', () => {
    const score = definition.score([result('go', true, 480)], 60)
    expect(score.metrics.medianRtMs).toBe(480)
    expect(score.metrics.rtVariabilitaet).toBe(0)
    expect(score.accuracy).toBe(1)
  })

  it('reports zero for an empty session without throwing', () => {
    const score = definition.score([], 60)
    expect(score.raw).toBe(0)
    expect(score.accuracy).toBe(0)
    expect(score.metrics.reize).toBe(0)
    expect(score.metrics.medianRtMs).toBe(0)
    expect(score.metrics.rtVariabilitaet).toBe(0)
  })
})
