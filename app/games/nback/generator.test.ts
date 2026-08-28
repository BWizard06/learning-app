import { describe, expect, it } from 'vitest'
import { createRng } from '~~/shared/rng'
import { runGeneratorContract } from '~~/shared/testing/generator-contract'
import { propertyRuns } from '~~/shared/testing/property'
import type { JsonValue, TrialResult } from '~~/shared/types'
import definition from './definition'
import {
  FEEDBACK_MS,
  ITEM_TYPES,
  LETTERS,
  POSITIONS,
  STREAM_LENGTH,
  durationMsFor,
  generateStream,
  nFor,
  variantForSeed,
  type Channel,
  type ItemType,
  type NbackBlock,
} from './generator'

const LEVELS = [1, 2, 3, 4]

const DURATION_TABLE: Record<number, number> = { 1: 2300, 2: 2100, 3: 1900, 4: 1700 }

const CHANNELS: Channel[] = ['position', 'letter']

const ACTIVE: Record<ItemType, Channel[]> = {
  visuell: ['position'],
  verbal: ['letter'],
  dual: ['position', 'letter'],
}

function blockRuns(): number {
  return Math.max(4, Math.ceil(propertyRuns() / 10))
}

function contractRuns(): number {
  return Math.max(4, Math.ceil(propertyRuns() / 50))
}

function seedFor(index: number): number {
  return index * 2654435761 + 1
}

function valuesOf(block: NbackBlock, channel: Channel): JsonValue[] {
  return block.trials.map((trial) =>
    channel === 'position' ? trial.params.position! : trial.params.letter!,
  )
}

function flagsOf(block: NbackBlock, channel: Channel): boolean[] {
  return block.trials.map((trial) =>
    channel === 'position' ? trial.params.positionMatch === true : trial.params.letterMatch === true,
  )
}

function actualMatches(values: readonly JsonValue[], n: number): boolean[] {
  return values.map((value, index) => index >= n && value !== null && value === values[index - n])
}

function blockFor(index: number, salt: number): NbackBlock {
  const n = LEVELS[index % LEVELS.length]!
  return generateStream(n, createRng(index * salt + 1))
}

describe('nback generator', () => {
  it('satisfies the shared generator contract', () => {
    runGeneratorContract(definition, {
      runs: contractRuns(),
      minItemTypes: ITEM_TYPES.length,
      checkTrial: (trial) => {
        expect(ITEM_TYPES).toContain(trial.itemType as ItemType)
        const payload = trial.payload as { index: number; total: number; durationMs: number }
        expect(payload.total).toBe(STREAM_LENGTH)
        expect(payload.index).toBeGreaterThanOrEqual(0)
        expect(payload.index).toBeLessThan(STREAM_LENGTH)
        expect(payload.durationMs).toBe(DURATION_TABLE[trial.difficulty])
      },
    })
  })

  it('shows each stimulus for two and a half seconds minus two hundred per n', () => {
    for (const n of LEVELS) {
      expect(durationMsFor(n)).toBe(DURATION_TABLE[n])
      const block = generateStream(n, createRng(n * 7919 + 11))
      expect(block.params.durationMs).toBe(DURATION_TABLE[n])
      for (const trial of block.trials) {
        expect((trial.payload as { durationMs: number }).durationMs).toBe(DURATION_TABLE[n])
      }
    }
    expect(nFor(0)).toBe(1)
    expect(nFor(9)).toBe(4)
    expect(nFor(2.4)).toBe(2)
  })

  it('keeps one block long enough for a whole default session', () => {
    for (const n of LEVELS) {
      const covered = STREAM_LENGTH * (DURATION_TABLE[n]! + FEEDBACK_MS)
      expect(covered).toBeGreaterThan(definition.defaultDurationS * 1000)
    }
  })

  it('lets about three in ten positions be a match', () => {
    const runs = blockRuns()
    let matches = 0
    let positions = 0

    for (let i = 0; i < runs; i++) {
      const block = blockFor(i, 104729)
      const n = block.trials[0]!.difficulty
      for (const channel of ACTIVE[block.itemType as ItemType]) {
        const actual = actualMatches(valuesOf(block, channel), n)
        const hits = actual.filter(Boolean).length
        const share = hits / actual.length
        expect(share, `${block.itemType} ${channel} at n ${n}`).toBeGreaterThanOrEqual(0.22)
        expect(share, `${block.itemType} ${channel} at n ${n}`).toBeLessThanOrEqual(0.38)
        matches += hits
        positions += actual.length
      }
    }

    const overall = matches / positions
    expect(overall).toBeGreaterThan(0.22)
    expect(overall).toBeLessThan(0.38)
  })

  it('marks a position as a match exactly when it repeats the stimulus n steps back', () => {
    const runs = blockRuns()
    const wrong: string[] = []

    for (let i = 0; i < runs; i++) {
      const block = blockFor(i, 15485863)
      const n = block.trials[0]!.difficulty
      for (const channel of CHANNELS) {
        const values = valuesOf(block, channel)
        const flags = flagsOf(block, channel)
        const actual = actualMatches(values, n)
        for (let index = 0; index < flags.length; index++) {
          if (flags[index] !== actual[index]) {
            wrong.push(`${block.itemType} ${channel} ${index} flag ${flags[index]}`)
          }
        }
      }
    }

    expect(wrong.slice(0, 5)).toEqual([])
  })

  it('never marks the first n positions of a stream', () => {
    const runs = blockRuns()
    for (let i = 0; i < runs; i++) {
      const block = blockFor(i, 32452843)
      const n = block.trials[0]!.difficulty
      for (const channel of CHANNELS) {
        for (const flag of flagsOf(block, channel).slice(0, n)) expect(flag).toBe(false)
      }
    }
  })

  it('draws every stimulus from the declared alphabets and silences the unused channel', () => {
    const runs = blockRuns()
    const seenPositions = new Set<JsonValue>()
    const seenLetters = new Set<JsonValue>()

    for (let i = 0; i < runs; i++) {
      const block = blockFor(i, 99991)
      const variant = block.itemType as ItemType
      const active = ACTIVE[variant]

      for (const channel of CHANNELS) {
        const values = valuesOf(block, channel)
        if (!active.includes(channel)) {
          expect(values.every((value) => value === null)).toBe(true)
          expect(flagsOf(block, channel).every((flag) => flag === false)).toBe(true)
          continue
        }
        for (const value of values) {
          if (channel === 'position') {
            expect(POSITIONS).toContain(value as number)
            seenPositions.add(value)
          } else {
            expect(LETTERS).toContain(value as string)
            seenLetters.add(value)
          }
        }
      }
    }

    expect(seenPositions.size).toBe(POSITIONS.length)
    expect(seenLetters.size).toBe(LETTERS.length)
  })

  it('slips in near misses one step off the target distance', () => {
    let lures = 0
    let nonMatches = 0

    for (let i = 0; i < 400; i++) {
      const block = blockFor(i, 2246822519)
      const n = block.trials[0]!.difficulty
      for (const channel of ACTIVE[block.itemType as ItemType]) {
        const values = valuesOf(block, channel)
        for (let index = n + 1; index < values.length; index++) {
          if (values[index] === values[index - n]) continue
          nonMatches++
          const before = values[index - n - 1]
          const after = index - n + 1 < index ? values[index - n + 1] : null
          if (values[index] === before || values[index] === after) lures++
        }
      }
    }

    expect(nonMatches).toBeGreaterThan(1000)
    expect(lures / nonMatches).toBeGreaterThan(0.15)
  })

  it('offers all three variants at every n', () => {
    for (const n of LEVELS) {
      const seen = new Set<string>()
      for (let i = 0; i < 90; i++) seen.add(generateStream(n, createRng(seedFor(i))).itemType)
      expect([...seen].sort(), `variants at n ${n}`).toEqual(['dual', 'verbal', 'visuell'])
    }
  })

  it('offers all three variants at the lowest n', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 90; i++) {
      const block = generateStream(definition.difficultyRange[0], createRng(seedFor(i)))
      seen.add(block.itemType)
      expect(block.trials.every((trial) => trial.itemType === block.itemType)).toBe(true)
    }
    expect([...seen].sort()).toEqual(['dual', 'verbal', 'visuell'])
  })

  it('keeps the variant stable while the same rng keeps drawing', () => {
    for (let i = 0; i < 60; i++) {
      const rng = createRng(seedFor(i))
      const first = generateStream(2, rng)
      const second = generateStream(3, rng)
      const third = generateStream(1, rng)

      expect(second.itemType).toBe(first.itemType)
      expect(third.itemType).toBe(first.itemType)
      expect(first.itemType).toBe(variantForSeed(rng.seed))
      expect(JSON.stringify(second.trials)).not.toBe(JSON.stringify(first.trials))
    }
  })

  it('produces the same stream twice for the same seed', () => {
    for (const n of LEVELS) {
      const a = generateStream(n, createRng(4711))
      const b = generateStream(n, createRng(4711))
      expect(JSON.stringify(a)).toBe(JSON.stringify(b))
      expect(a.trials).toHaveLength(STREAM_LENGTH)
    }
  })
})

function resultFor(
  type: ItemType,
  difficulty: number,
  expected: { position?: boolean; letter?: boolean },
  response: JsonValue,
  rtMs = 900,
): TrialResult {
  return {
    idx: 0,
    itemType: type,
    difficulty,
    params: {
      type,
      n: difficulty,
      index: 0,
      total: STREAM_LENGTH,
      position: 1,
      letter: 'B',
      positionMatch: expected.position === true,
      letterMatch: expected.letter === true,
      durationMs: DURATION_TABLE[difficulty]!,
    },
    response,
    correct: false,
    rtMs,
    presentedAt: 0,
  }
}

function tap(position: boolean, letter: boolean, positionRtMs = 0, letterRtMs = 0): JsonValue {
  return { position, letter, positionRtMs, letterRtMs }
}

describe('nback scoring', () => {
  it('counts hits, false alarms and misses per channel', () => {
    const score = definition.score(
      [
        resultFor('visuell', 1, { position: true }, tap(true, false, 700)),
        resultFor('visuell', 1, { position: true }, null),
        resultFor('visuell', 1, {}, tap(true, false, 500)),
        resultFor('visuell', 1, {}, null),
      ],
      60,
    )

    expect(score.metrics.treffer).toBe(1)
    expect(score.metrics.verpasst).toBe(1)
    expect(score.metrics.falscheAlarme).toBe(1)
    expect(score.accuracy).toBeCloseTo(1 / 3, 10)
    expect(score.raw).toBe(0)
  })

  it('scores both channels of a dual trial on their own', () => {
    const score = definition.score(
      [
        resultFor('dual', 2, { position: true, letter: true }, tap(true, true, 600, 800)),
        resultFor('dual', 2, { position: true, letter: false }, tap(false, true, 0, 400)),
      ],
      60,
    )

    expect(score.metrics.treffer).toBe(2)
    expect(score.metrics.verpasst).toBe(1)
    expect(score.metrics.falscheAlarme).toBe(1)
    expect(score.metrics.medianRtMs).toBe(700)
    expect(score.metrics.nLevel).toBe(2)
    expect(score.raw).toBeCloseTo(1.5 * (2 - 1), 10)
  })

  it('turns hits net of false alarms into a per minute rate', () => {
    const trials = [
      ...Array.from({ length: 9 }, () =>
        resultFor('verbal', 1, { letter: true }, tap(false, true, 0, 800)),
      ),
      ...Array.from({ length: 3 }, () => resultFor('verbal', 1, {}, tap(false, true, 0, 800))),
    ]

    expect(definition.score(trials, 60).raw).toBeCloseTo(6, 10)
    expect(definition.score(trials, 120).raw).toBeCloseTo(3, 10)
    expect(definition.score(trials, 30).raw).toBeCloseTo(12, 10)
  })

  it('pays more for the same accuracy at a higher n', () => {
    const sessionAt = (n: number) =>
      definition.score(
        [
          resultFor('visuell', n, { position: true }, tap(true, false, 800)),
          resultFor('visuell', n, { position: true }, tap(true, false, 800)),
          resultFor('visuell', n, { position: true }, null),
          resultFor('visuell', n, {}, null),
        ],
        60,
      )

    const easy = sessionAt(1)
    const hard = sessionAt(3)

    expect(easy.accuracy).toBe(hard.accuracy)
    expect(easy.raw).toBeCloseTo(2, 10)
    expect(hard.raw).toBeCloseTo(4, 10)
    expect(hard.raw).toBeGreaterThan(easy.raw)
    expect(hard.metrics.nLevel).toBe(3)
  })

  it('gives nothing away to someone who never lifts a finger', () => {
    const trials = [
      resultFor('dual', 4, { position: true, letter: true }, null),
      resultFor('dual', 4, {}, null),
      resultFor('dual', 4, {}, null),
    ]
    const score = definition.score(trials, 60)

    expect(score.raw).toBe(0)
    expect(score.accuracy).toBe(0)
    expect(score.metrics.verpasst).toBe(2)
    expect(score.metrics.medianRtMs).toBe(0)
  })

  it('gives nothing away to someone who taps at every stimulus', () => {
    const trials = [
      resultFor('verbal', 4, { letter: true }, tap(false, true, 0, 300)),
      ...Array.from({ length: 6 }, () => resultFor('verbal', 4, {}, tap(false, true, 0, 300))),
    ]
    const score = definition.score(trials, 60)

    expect(score.metrics.treffer).toBe(1)
    expect(score.metrics.falscheAlarme).toBe(6)
    expect(score.raw).toBe(0)
  })

  it('reports zero for an empty session without throwing', () => {
    const score = definition.score([], 60)
    expect(score.raw).toBe(0)
    expect(score.accuracy).toBe(0)
    expect(score.metrics.treffer).toBe(0)
    expect(score.metrics.nLevel).toBe(0)
  })
})

describe('nback judging', () => {
  const trialFor = (index: number, block: NbackBlock) => block.trials[index]!

  it('accepts a tap only on a real match and silence only on a real non match', () => {
    const block = generateStream(2, createRng(5150))
    const channel = ACTIVE[block.itemType as ItemType][0]!
    const match = block.trials.findIndex((trial) => trial.answer[channel])
    const quiet = block.trials.findIndex((trial) => !trial.answer.position && !trial.answer.letter)

    const matchTrial = trialFor(match, block)
    const quietTrial = trialFor(quiet, block)

    expect(definition.isCorrect!(matchTrial, tap(channel === 'position', channel === 'letter'))).toBe(true)
    expect(definition.isCorrect!(matchTrial, null)).toBe(false)
    expect(definition.isCorrect!(quietTrial, null)).toBe(true)
    expect(definition.isCorrect!(quietTrial, tap(true, true))).toBe(false)
  })

  it('ignores the channel a variant does not use', () => {
    const visuell = resultFor('visuell', 1, { position: true }, null)
    const trial = {
      itemType: 'visuell',
      difficulty: 1,
      params: visuell.params,
      payload: {},
      answer: { position: true, letter: false },
    }

    expect(definition.isCorrect!(trial, tap(true, true))).toBe(true)
    expect(definition.isCorrect!(trial, tap(true, false))).toBe(true)
    expect(definition.isCorrect!(trial, tap(false, true))).toBe(false)
  })

  it('treats junk responses as no tap at all', () => {
    const trial = {
      itemType: 'dual',
      difficulty: 3,
      params: resultFor('dual', 3, {}, null).params,
      payload: {},
      answer: { position: false, letter: false },
    }

    for (const junk of [null, 'ja', 42, [], { position: 'wahr' }] as JsonValue[]) {
      expect(definition.isCorrect!(trial, junk), JSON.stringify(junk)).toBe(true)
    }
  })
})
