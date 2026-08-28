import { describe, expect, it } from 'vitest'
import { createRng } from '~~/shared/rng'
import { runGeneratorContract } from '~~/shared/testing/generator-contract'
import { propertyRuns } from '~~/shared/testing/property'
import type { JsonObject } from '~~/shared/types'
import definition from './definition'
import {
  ITEM_TYPES,
  METRIC_UNITS,
  factorBetween,
  generateUmrechnung,
  kmhFromMps,
  pairsFor,
  percentFor,
  realMetresFor,
  secondsFor,
  unitByKey,
  type ItemType,
  type UmrechnenPayload,
  type UmrechnenTrial,
} from './generator'

const KNOWN_LENGTH: readonly (readonly [string, string, number])[] = [
  ['cm', 'mm', 10],
  ['dm', 'cm', 10],
  ['m', 'cm', 100],
  ['m', 'mm', 1000],
  ['km', 'm', 1000],
  ['km', 'cm', 100000],
]

const KNOWN_AREA: readonly (readonly [string, string, number])[] = [
  ['cm2', 'mm2', 100],
  ['dm2', 'cm2', 100],
  ['m2', 'dm2', 100],
  ['m2', 'cm2', 10000],
  ['a', 'm2', 100],
  ['ha', 'a', 100],
  ['ha', 'm2', 10000],
  ['km2', 'ha', 100],
  ['km2', 'm2', 1000000],
]

const KNOWN_VOLUME: readonly (readonly [string, string, number])[] = [
  ['cm3', 'mm3', 1000],
  ['dm3', 'cm3', 1000],
  ['m3', 'dm3', 1000],
  ['m3', 'cm3', 1000000],
  ['dm3', 'l', 1],
  ['cm3', 'ml', 1],
  ['l', 'ml', 1000],
  ['l', 'dl', 10],
  ['dl', 'cl', 10],
  ['cl', 'ml', 10],
  ['hl', 'l', 100],
  ['m3', 'l', 1000],
]

const KNOWN_TIME: readonly (readonly [string, string, number])[] = [
  ['min', 's', 60],
  ['h', 'min', 60],
  ['h', 's', 3600],
  ['d', 'h', 24],
  ['d', 'min', 1440],
  ['d', 's', 86400],
]

const KNOWN_METRIC = [...KNOWN_LENGTH, ...KNOWN_AREA, ...KNOWN_VOLUME]
const KNOWN_PAIRS = [...KNOWN_METRIC, ...KNOWN_TIME]

const KNOWN_SPEEDS: readonly (readonly [number, number])[] = [
  [5, 18],
  [10, 36],
  [15, 54],
  [20, 72],
  [25, 90],
  [30, 108],
]

const KNOWN_SCALES: readonly (readonly [number, number, number])[] = [
  [100, 7, 7],
  [1000, 5, 50],
  [2500, 8, 200],
  [25000, 4, 1000],
  [50000, 3, 1500],
]

const KNOWN_FRACTIONS: readonly (readonly [number, number, number])[] = [
  [1, 2, 50],
  [1, 4, 25],
  [3, 4, 75],
  [1, 5, 20],
  [2, 5, 40],
  [3, 5, 60],
  [4, 5, 80],
  [1, 10, 10],
  [3, 10, 30],
  [9, 10, 90],
  [1, 20, 5],
  [3, 20, 15],
  [1, 25, 4],
  [3, 25, 12],
  [1, 50, 2],
  [7, 50, 14],
]

interface Ratio {
  num: number
  den: number
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y !== 0) {
    const t = y
    y = x % y
    x = t
  }
  return x
}

function reduce(ratio: Ratio): Ratio {
  const divisor = gcd(ratio.num, ratio.den) || 1
  return { num: ratio.num / divisor, den: ratio.den / divisor }
}

const EDGES = new Map<string, { to: string; ratio: Ratio }[]>()

function addEdge(from: string, to: string, ratio: Ratio) {
  const list = EDGES.get(from) ?? []
  list.push({ to, ratio })
  EDGES.set(from, list)
}

for (const [big, small, factor] of KNOWN_PAIRS) {
  addEdge(big, small, { num: factor, den: 1 })
  addEdge(small, big, { num: 1, den: factor })
}

function pathFactor(from: string, to: string): Ratio {
  if (from === to) return { num: 1, den: 1 }
  const seen = new Set<string>([from])
  let frontier: { unit: string; ratio: Ratio }[] = [{ unit: from, ratio: { num: 1, den: 1 } }]
  while (frontier.length > 0) {
    const next: { unit: string; ratio: Ratio }[] = []
    for (const node of frontier) {
      for (const edge of EDGES.get(node.unit) ?? []) {
        if (seen.has(edge.to)) continue
        const ratio = reduce({
          num: node.ratio.num * edge.ratio.num,
          den: node.ratio.den * edge.ratio.den,
        })
        if (edge.to === to) return ratio
        seen.add(edge.to)
        next.push({ unit: edge.to, ratio })
      }
    }
    frontier = next
  }
  throw new Error(`kein bekannter Weg von ${from} nach ${to}`)
}

function numberOf(params: JsonObject, key: string): number {
  const value = params[key]
  expect(typeof value, `${key} muss eine Zahl sein`).toBe('number')
  return value as number
}

function textOf(params: JsonObject, key: string): string {
  const value = params[key]
  expect(typeof value, `${key} muss ein Text sein`).toBe('string')
  return value as string
}

function payloadOf(trial: UmrechnenTrial): UmrechnenPayload {
  return trial.payload
}

function checkAgainstKnownTable(trial: UmrechnenTrial) {
  const params = trial.params
  const answer = trial.answer

  switch (trial.itemType) {
    case 'laenge':
    case 'flaeche':
    case 'volumen': {
      const ratio = pathFactor(textOf(params, 'from'), textOf(params, 'to'))
      expect(numberOf(params, 'given') * ratio.num).toBe(answer * ratio.den)
      expect(payloadOf(trial).suffix).toBe(unitByKey(textOf(params, 'to')).label)
      break
    }
    case 'zeit': {
      const ratio = pathFactor(textOf(params, 'from'), textOf(params, 'to'))
      if (params.variant === 'einfach') {
        expect(numberOf(params, 'given') * ratio.num).toBe(answer * ratio.den)
      } else {
        expect(ratio.den).toBe(1)
        expect(answer).toBe(numberOf(params, 'major') * ratio.num + numberOf(params, 'minor'))
        expect(numberOf(params, 'minor')).toBeGreaterThan(0)
        expect(numberOf(params, 'minor')).toBeLessThan(ratio.num)
      }
      break
    }
    case 'geschwindigkeit': {
      const mps = numberOf(params, 'mps')
      const kmh = numberOf(params, 'kmh')
      expect(kmh * 5).toBe(mps * 18)
      if (params.variant === 'mps-zu-kmh') {
        expect(numberOf(params, 'given')).toBe(mps)
        expect(answer).toBe(kmh)
      } else {
        expect(numberOf(params, 'given')).toBe(kmh)
        expect(answer).toBe(mps)
      }
      break
    }
    case 'massstab': {
      const scale = numberOf(params, 'scale')
      const mapCm = numberOf(params, 'mapCm')
      const realM = numberOf(params, 'realM')
      expect(realM * 100).toBe(mapCm * scale)
      if (params.variant === 'karte-zu-real') {
        expect(numberOf(params, 'given')).toBe(mapCm)
        expect(answer).toBe(realM)
        expect(payloadOf(trial).suffix).toBe('m')
      } else {
        expect(numberOf(params, 'given')).toBe(realM)
        expect(answer).toBe(mapCm)
        expect(payloadOf(trial).suffix).toBe('cm')
      }
      break
    }
    case 'bruch-prozent': {
      const numerator = numberOf(params, 'numerator')
      const denominator = numberOf(params, 'denominator')
      const percent = numberOf(params, 'percent')
      expect(percent * denominator).toBe(numerator * 100)
      expect(gcd(numerator, denominator)).toBe(1)
      expect(numerator).toBeLessThan(denominator)
      expect(answer).toBe(params.variant === 'bruch-zu-prozent' ? percent : numerator)
      break
    }
    default:
      throw new Error(`unbekannter Itemtyp ${trial.itemType}`)
  }
}

function sampleAt(difficulty: number, count: number, salt: number): UmrechnenTrial[] {
  const trials: UmrechnenTrial[] = []
  for (let i = 0; i < count; i++) {
    trials.push(generateUmrechnung(difficulty, createRng(i * 2654435761 + salt)))
  }
  return trials
}

describe('einheiten conversion table', () => {
  it('matches a table of known conversions written out by hand', () => {
    expect(KNOWN_PAIRS.length).toBeGreaterThanOrEqual(20)
    for (const [big, small, factor] of KNOWN_METRIC) {
      expect(factorBetween(big, small), `1 ${big} in ${small}`).toBe(factor)
      expect(factorBetween(small, big)).toBeCloseTo(1 / factor, 12)
    }
    for (const [big, small, factor] of KNOWN_TIME) {
      expect(secondsFor(big) / secondsFor(small), `1 ${big} in ${small}`).toBe(factor)
    }
  })

  it('keeps square and cubic units apart from the linear ones', () => {
    expect(factorBetween('m2', 'cm2')).toBe(10000)
    expect(factorBetween('m2', 'cm2')).not.toBe(factorBetween('m', 'cm'))
    expect(factorBetween('m3', 'cm3')).toBe(1000000)
    expect(factorBetween('m3', 'cm3')).not.toBe(1000)
    expect(factorBetween('ha', 'm2')).toBe(10000)
    expect(factorBetween('km2', 'm2')).toBe(1000000)
    expect(factorBetween('l', 'ml')).toBe(1000)
    expect(factorBetween('dm3', 'l')).toBe(1)
  })

  it('matches known speeds, scales and fractions', () => {
    for (const [mps, kmh] of KNOWN_SPEEDS) {
      expect(kmhFromMps(mps), `${mps} m/s in km/h`).toBe(kmh)
    }
    for (const [scale, mapCm, realM] of KNOWN_SCALES) {
      expect(realMetresFor(scale, mapCm), `1:${scale} mit ${mapCm} cm`).toBe(realM)
    }
    for (const [numerator, denominator, percent] of KNOWN_FRACTIONS) {
      expect(percentFor(numerator, denominator), `${numerator}/${denominator}`).toBe(percent)
    }
  })

  it('offers usable unit pairs for every dimension and difficulty', () => {
    for (const dimension of ['laenge', 'flaeche', 'volumen'] as const) {
      for (let difficulty = 1; difficulty <= 6; difficulty++) {
        const pairs = pairsFor(dimension, difficulty)
        expect(pairs.length, `${dimension} auf Stufe ${difficulty}`).toBeGreaterThan(0)
        for (const pair of pairs) {
          expect(pair.steps).toBeGreaterThan(0)
          expect(pair.from.key).not.toBe(pair.to.key)
        }
      }
    }
    expect(METRIC_UNITS.flaeche.some((unit) => unit.key === 'ha')).toBe(true)
    expect(METRIC_UNITS.volumen.some((unit) => unit.key === 'hl')).toBe(true)
  })
})

describe('einheiten generator', () => {
  it('satisfies the shared generator contract', () => {
    runGeneratorContract(definition, {
      expectIntegerAnswer: true,
      minItemTypes: ITEM_TYPES.length,
      answerRange: [1, 1_000_000],
      checkTrial: (trial) => {
        const payload = trial.payload as UmrechnenPayload
        expect(payload.prompt.length).toBeGreaterThan(0)
        expect(payload.suffix.length).toBeGreaterThan(0)
        expect(payload.label.length).toBeGreaterThan(0)
        expect(payload.prompt).not.toContain('undefined')
      },
    })
  })

  it('solves every generated item against the hand written table', () => {
    const runs = propertyRuns()
    const seen = new Set<ItemType>()
    for (let i = 0; i < runs; i++) {
      const difficulty = (i % 6) + 1
      const trial = generateUmrechnung(difficulty, createRng(i * 104729 + 17))
      seen.add(trial.itemType as ItemType)
      checkAgainstKnownTable(trial)
    }
    expect(seen.size).toBe(ITEM_TYPES.length)
  })

  it('asks and answers only with whole positive numbers', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const trial = generateUmrechnung((i % 6) + 1, createRng(i * 7919 + 3))
      expect(Number.isInteger(trial.answer)).toBe(true)
      expect(trial.answer).toBeGreaterThan(0)
      expect(trial.answer).toBeLessThanOrEqual(1_000_000)
      const given = trial.params.given
      if (typeof given === 'number') {
        expect(Number.isInteger(given)).toBe(true)
        expect(given).toBeGreaterThan(0)
        expect(given).toBeLessThanOrEqual(1_000_000)
        const leading = ['laenge', 'flaeche', 'volumen', 'geschwindigkeit'].includes(trial.itemType)
        if (leading) expect(trial.payload.prompt.startsWith(`${given} `)).toBe(true)
        else expect(trial.payload.prompt).toContain(String(given))
      }
    }
  })

  it('reaches every item type and every variant at the lowest difficulty', () => {
    const trials = sampleAt(1, 4000, 11)
    const types = new Set(trials.map((trial) => trial.itemType))
    const variants = new Set(trials.map((trial) => `${trial.itemType}:${trial.params.variant}`))

    expect([...types].sort()).toEqual([...ITEM_TYPES].sort())
    expect([...variants].sort()).toEqual(
      [
        'bruch-prozent:bruch-zu-prozent',
        'bruch-prozent:prozent-zu-bruch',
        'flaeche:metrisch',
        'geschwindigkeit:kmh-zu-mps',
        'geschwindigkeit:mps-zu-kmh',
        'laenge:metrisch',
        'massstab:karte-zu-real',
        'massstab:real-zu-karte',
        'volumen:metrisch',
        'zeit:einfach',
        'zeit:gemischt',
      ].sort(),
    )
  })

  it('converts in both directions at the lowest difficulty', () => {
    const trials = sampleAt(1, 4000, 29)
    const directions = new Set<string>()
    for (const trial of trials) {
      if (!['laenge', 'flaeche', 'volumen', 'zeit'].includes(trial.itemType)) continue
      const given = trial.params.given
      if (typeof given !== 'number') continue
      directions.add(`${trial.itemType}:${trial.answer > given ? 'hinunter' : 'hinauf'}`)
    }
    expect([...directions].sort()).toEqual([
      'flaeche:hinauf',
      'flaeche:hinunter',
      'laenge:hinauf',
      'laenge:hinunter',
      'volumen:hinauf',
      'volumen:hinunter',
      'zeit:hinauf',
      'zeit:hinunter',
    ])
  })

  it('holds the awkward units back on the easy levels', () => {
    const awkward = ['a', 'ha', 'mm3', 'cm3', 'dm3', 'm3']
    for (const difficulty of [1, 2]) {
      for (const trial of sampleAt(difficulty, 1500, 41 + difficulty)) {
        expect(awkward).not.toContain(trial.params.from)
        expect(awkward).not.toContain(trial.params.to)
        if (trial.itemType === 'massstab') {
          expect(numberOf(trial.params, 'scale')).toBeLessThanOrEqual(1000)
        }
        if (trial.itemType === 'bruch-prozent') {
          expect(numberOf(trial.params, 'denominator')).toBeLessThanOrEqual(10)
        }
      }
    }

    const late = sampleAt(6, 3000, 53)
    const units = new Set<unknown>()
    for (const trial of late) {
      units.add(trial.params.from)
      units.add(trial.params.to)
    }
    for (const unit of awkward) {
      expect(units.has(unit), `${unit} fehlt auf Stufe 6`).toBe(true)
    }
    expect(late.some((trial) => Number(trial.params.scale) > 1000)).toBe(true)
    expect(late.some((trial) => Number(trial.params.denominator) > 10)).toBe(true)
  })

  it('moves the decimal point further as difficulty rises', () => {
    const stepsAt = (difficulty: number) =>
      sampleAt(difficulty, 1200, 67)
        .map((trial) => trial.params.steps)
        .filter((value): value is number => typeof value === 'number')
    const meanSteps = (difficulty: number) => {
      const steps = stepsAt(difficulty)
      return steps.reduce((sum, value) => sum + value, 0) / steps.length
    }
    expect(meanSteps(6)).toBeGreaterThan(meanSteps(1))
    expect(meanSteps(4)).toBeGreaterThan(meanSteps(1))
    expect(Math.max(...stepsAt(1))).toBeLessThanOrEqual(3)
    expect(Math.max(...stepsAt(6))).toBeGreaterThanOrEqual(6)

    for (const dimension of ['laenge', 'flaeche', 'volumen'] as const) {
      const spread = (difficulty: number) => pairsFor(dimension, difficulty).map((pair) => pair.steps)
      expect(Math.max(...spread(6)), dimension).toBeGreaterThan(Math.max(...spread(1)))
      expect(Math.min(...spread(6)), dimension).toBeGreaterThan(Math.min(...spread(1)))
    }
  })
})

describe('einheiten scoring', () => {
  const result = (correct: boolean, difficulty: number, rtMs = 4000) => ({
    idx: 0,
    itemType: 'laenge',
    difficulty,
    params: { steps: 3 },
    response: 1,
    correct,
    rtMs,
    presentedAt: 0,
  })

  it('rewards the same accuracy at higher difficulty', () => {
    const easy = definition.score([result(true, 1), result(true, 1), result(false, 1)], 60)
    const hard = definition.score([result(true, 6), result(true, 6), result(false, 6)], 60)
    expect(easy.accuracy).toBe(hard.accuracy)
    expect(hard.raw).toBeGreaterThan(easy.raw)
  })

  it('reports the mean number of decimal steps', () => {
    const score = definition.score([result(true, 3), result(true, 3)], 60)
    expect(score.metrics.mittlereSchritte).toBe(3)
  })

  it('reports zero for an empty session without throwing', () => {
    const score = definition.score([], 60)
    expect(score.raw).toBe(0)
    expect(score.accuracy).toBe(0)
    expect(score.metrics.medianRtMs).toBe(0)
  })
})
