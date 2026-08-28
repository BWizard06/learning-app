import { describe, expect, it } from 'vitest'
import { createRng } from '~~/shared/rng'
import { runGeneratorContract } from '~~/shared/testing/generator-contract'
import { propertyRuns } from '~~/shared/testing/property'
import definition from './definition'
import {
  CONSTANT_SOURCE,
  DISTRACTOR_COUNT,
  FALLBACK_CONFIG,
  FEATURE_KEYS,
  FILLS,
  OPTION_COUNT,
  RULE_SOURCES,
  SHAPES,
  SHAPE_POINTS,
  SOLUTION_SOURCE,
  buildConfig,
  buildFigures,
  buildPool,
  describeFigure,
  figureToSvg,
  generateSeries,
  type FeatureKey,
  type Figure,
  type SeriesPayload,
  type ShapeName,
} from './generator'

const SIZE: Record<FeatureKey, number> = {
  rotation: 8,
  spiegelung: 2,
  anzahl: 6,
  fuellung: 3,
  position: 8,
}

const CYCLIC: Record<FeatureKey, boolean> = {
  rotation: true,
  spiegelung: true,
  anzahl: false,
  fuellung: true,
  position: true,
}

type StoredRule = { feature: FeatureKey; step: number }
type StoredSource = { feature: string; source: string }

interface Parsed {
  type: string
  shape: ShapeName
  shownLen: number
  rules: StoredRule[]
  figures: Figure[]
  options: Figure[]
  sources: StoredSource[]
  correctIndex: number
}

function parse(params: unknown): Parsed {
  return params as unknown as Parsed
}

function ring(value: number, size: number): number {
  return ((value % size) + size) % size
}

function delta(feature: FeatureKey, from: number, to: number): number {
  return CYCLIC[feature] ? ring(to - from, SIZE[feature]) : to - from
}

function adjacent(feature: FeatureKey, a: number, b: number): boolean {
  if (!CYCLIC[feature]) return Math.abs(a - b) === 1
  const size = SIZE[feature]
  return ring(a - b, size) === 1 || ring(b - a, size) === 1
}

function stepsOf(parsed: Parsed): Map<FeatureKey, number> {
  return new Map(parsed.rules.map((rule) => [rule.feature, rule.step]))
}

function rowDeltas(parsed: Parsed): Record<FeatureKey, number> {
  const shown = parsed.figures.slice(0, parsed.shownLen)
  const out = {} as Record<FeatureKey, number>
  for (const feature of FEATURE_KEYS) {
    out[feature] = delta(feature, shown[0]![feature], shown[1]![feature])
  }
  return out
}

function figureKey(figure: Figure): string {
  return FEATURE_KEYS.map((feature) => String(figure[feature])).join('|')
}

function trialFor(index: number, salt: number, difficulty = (index % 8) + 1) {
  return generateSeries(difficulty, createRng(index * 2654435761 + salt))
}

function transformedPoints(
  points: readonly (readonly [number, number])[],
  rotation: number,
  mirror: number,
): string {
  const angle = (rotation * 45 * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return points
    .map(([x, y]) => {
      const flipped = mirror === 1 ? -x : x
      return `${(flipped * cos - y * sin).toFixed(4)},${(flipped * sin + y * cos).toFixed(4)}`
    })
    .sort()
    .join(' ')
}

function everyFigure(): { shape: ShapeName; figure: Figure }[] {
  const out: { shape: ShapeName; figure: Figure }[] = []
  for (const shape of SHAPES) {
    for (let rotation = 0; rotation < SIZE.rotation; rotation++) {
      for (let spiegelung = 0; spiegelung < SIZE.spiegelung; spiegelung++) {
        for (let anzahl = 0; anzahl < SIZE.anzahl; anzahl++) {
          for (let fuellung = 0; fuellung < SIZE.fuellung; fuellung++) {
            for (let position = 0; position < SIZE.position; position++) {
              out.push({ shape, figure: { rotation, spiegelung, anzahl, fuellung, position } })
            }
          }
        }
      }
    }
  }
  return out
}

describe('figurenreihen generator', () => {
  it('satisfies the shared generator contract', () => {
    runGeneratorContract(definition, {
      expectIntegerAnswer: true,
      minItemTypes: 4,
      checkTrial: (trial) => {
        const payload = trial.payload as SeriesPayload
        const parsed = parse(trial.params)
        expect([4, 5]).toContain(parsed.shownLen)
        expect(payload.figures).toHaveLength(parsed.shownLen)
        for (const figure of payload.figures) expect(figure.startsWith('<svg')).toBe(true)
        expect(payload.question.length).toBeGreaterThan(0)
        expect(payload.question).not.toContain('ß')
        expect(trial.options).toHaveLength(OPTION_COUNT)
        for (const option of trial.options!) expect(option.svg?.startsWith('<svg')).toBe(true)
        expect(trial.answer).toBe(trial.correctIndex)
        expect(parsed.figures).toHaveLength(parsed.shownLen + 1)
      },
    })
  })

  it('grows every figure of the row out of the start by the closed form of its rule', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const parsed = parse(trialFor(i, 11).params)
      const steps = stepsOf(parsed)
      const start = parsed.figures[0]!

      for (let position = 0; position <= parsed.shownLen; position++) {
        for (const feature of FEATURE_KEYS) {
          const step = steps.get(feature) ?? 0
          const raw = start[feature] + position * step
          const expected = CYCLIC[feature] ? ring(raw, SIZE[feature]) : raw
          expect(
            parsed.figures[position]![feature],
            `${feature} an Stelle ${position} folgt der Regel nicht`,
          ).toBe(expected)
        }
      }
    }
  })

  it('carries the same difference from the last shown figure into the correct option', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const trial = trialFor(i, 23)
      const parsed = parse(trial.params)
      const values = parsed.figures
      const moving = new Set<FeatureKey>()

      for (const feature of FEATURE_KEYS) {
        const seen = new Set<number>()
        for (let position = 1; position < values.length; position++) {
          seen.add(delta(feature, values[position - 1]![feature], values[position]![feature]))
        }
        expect(seen.size, `${feature} schreitet nicht gleichmaessig`).toBe(1)
        const step = [...seen][0]!
        if (step !== 0) moving.add(feature)
      }

      const declared = new Set(parsed.rules.map((rule) => rule.feature))
      expect([...moving].sort()).toEqual([...declared].sort())
      expect(parsed.options[parsed.correctIndex]).toEqual(values[parsed.shownLen])

      for (const rule of parsed.rules) {
        const observed = delta(rule.feature, values[0]![rule.feature], values[1]![rule.feature])
        const written = CYCLIC[rule.feature] ? ring(rule.step, SIZE[rule.feature]) : rule.step
        expect(observed, `${rule.feature} laeuft nicht mit dem notierten Schritt`).toBe(written)
        expect(Math.abs(rule.step)).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('leaves the correct option as the only one that continues the row', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const trial = trialFor(i, 37)
      const parsed = parse(trial.params)
      const steps = rowDeltas(parsed)
      const last = parsed.figures[parsed.shownLen - 1]!

      const fitting = parsed.options
        .map((option, index) =>
          FEATURE_KEYS.every((feature) => delta(feature, last[feature], option[feature]) === steps[feature])
            ? index
            : -1,
        )
        .filter((index) => index >= 0)

      expect(fitting, `Optionen ${fitting.join(',')} setzen die Reihe fort`).toEqual([parsed.correctIndex])
    }
  })

  it('keeps all six options apart as feature vectors, as svg and as text', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const trial = trialFor(i, 53)
      const parsed = parse(trial.params)
      expect(new Set(parsed.options.map(figureKey)).size).toBe(OPTION_COUNT)
      expect(new Set(trial.options!.map((option) => option.svg)).size).toBe(OPTION_COUNT)
      expect(new Set(trial.options!.map((option) => option.label)).size).toBe(OPTION_COUNT)
      expect(new Set(trial.options!.map((option) => option.id)).size).toBe(OPTION_COUNT)
    }
  })

  it('explains every distractor by exactly one named misreading', () => {
    const runs = propertyRuns()
    const usedSources = new Set<string>()
    for (let i = 0; i < runs; i++) {
      const trial = trialFor(i, 61)
      const parsed = parse(trial.params)
      const answer = parsed.figures[parsed.shownLen]!
      const last = parsed.figures[parsed.shownLen - 1]!
      const first = parsed.figures[0]!
      const declared = new Set(parsed.rules.map((rule) => rule.feature))

      let distractors = 0
      const touched = new Set<string>()

      parsed.options.forEach((option, index) => {
        const source = parsed.sources[index]!
        if (index === parsed.correctIndex) {
          expect(source.source).toBe(SOLUTION_SOURCE)
          expect(source.feature).toBe('keines')
          return
        }
        distractors++
        touched.add(source.feature)
        usedSources.add(source.source)

        const changed = FEATURE_KEYS.filter((feature) => option[feature] !== answer[feature])
        expect(changed, `Option ${index} weicht in ${changed.length} Merkmalen ab`).toEqual([
          source.feature,
        ])

        const feature = source.feature as FeatureKey
        const step = delta(feature, last[feature], answer[feature])
        const value = option[feature]

        if (source.source === CONSTANT_SOURCE) {
          expect(declared.has(feature)).toBe(false)
          expect(step).toBe(0)
          expect(adjacent(feature, answer[feature], value), 'falsches Merkmal springt zu weit').toBe(true)
          return
        }

        expect(declared.has(feature)).toBe(true)
        expect(RULE_SOURCES as readonly string[]).toContain(source.source)

        if (source.source === 'zu-weit') expect(delta(feature, answer[feature], value)).toBe(step)
        if (source.source === 'zu-kurz') expect(value).toBe(last[feature])
        if (source.source === 'gegenrichtung') expect(delta(feature, value, last[feature])).toBe(step)
        if (source.source === 'startwert') expect(value).toBe(first[feature])
      })

      expect(distractors).toBe(DISTRACTOR_COUNT)
      expect(touched.size).toBeGreaterThanOrEqual(2)
      if (parsed.rules.length === 3) {
        for (const feature of touched) expect(declared.has(feature as FeatureKey)).toBe(true)
      }
    }
    expect([...usedSources].sort()).toEqual(
      [CONSTANT_SOURCE, ...RULE_SOURCES].sort(),
    )
  })

  it('shows exactly the row and the options that params describe', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const trial = trialFor(i, 71)
      const parsed = parse(trial.params)
      const payload = trial.payload as SeriesPayload

      expect(payload.figures).toEqual(
        parsed.figures.slice(0, parsed.shownLen).map((figure) => figureToSvg(parsed.shape, figure)),
      )
      expect(trial.options!.map((option) => option.svg)).toEqual(
        parsed.options.map((figure) => figureToSvg(parsed.shape, figure)),
      )
      expect(trial.options!.map((option) => option.label)).toEqual(
        parsed.options.map((figure) => describeFigure(parsed.shape, figure)),
      )
      expect(SHAPES as readonly string[]).toContain(parsed.shape)
    }
  })

  it('never lets a feature leave its domain', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const parsed = parse(trialFor(i, 83).params)
      for (const figure of [...parsed.figures, ...parsed.options]) {
        for (const feature of FEATURE_KEYS) {
          expect(Number.isInteger(figure[feature])).toBe(true)
          expect(figure[feature]).toBeGreaterThanOrEqual(0)
          expect(figure[feature]).toBeLessThan(SIZE[feature])
        }
      }
    }
  })

  it('names every running transformation in the item type', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const trial = trialFor(i, 97)
      const parsed = parse(trial.params)
      const names = parsed.rules.map((rule) => rule.feature as string).sort()
      expect(trial.itemType).toBe(`reihe${names.length}-${names.join('+')}`)
      expect(parsed.type).toBe(trial.itemType)
      expect(new Set(names).size).toBe(names.length)
    }
  })

  it('reaches every single transformation at the lowest difficulty', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 3000; i++) {
      seen.add(generateSeries(1, createRng(i * 40503 + 7)).itemType)
    }
    expect([...seen].sort()).toEqual([
      'reihe1-anzahl',
      'reihe1-fuellung',
      'reihe1-position',
      'reihe1-rotation',
      'reihe1-spiegelung',
    ])
  })

  it('shows both row lengths at every difficulty', () => {
    for (let difficulty = 1; difficulty <= 8; difficulty++) {
      const lengths = new Set<number>()
      for (let i = 0; i < 200; i++) {
        lengths.add(parse(generateSeries(difficulty, createRng(i * 15485863 + difficulty)).params).shownLen)
      }
      expect([...lengths].sort()).toEqual([4, 5])
    }
  })

  it('raises the number of running transformations with difficulty', () => {
    const meanRules = (difficulty: number) => {
      let total = 0
      for (let i = 0; i < 400; i++) {
        total += parse(generateSeries(difficulty, createRng(i * 7919 + difficulty)).params).rules.length
      }
      return total / 400
    }
    const curve = [1, 2, 3, 4, 5, 6, 7, 8].map(meanRules)
    expect(curve[0]).toBe(1)
    expect(curve[7]).toBe(3)
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i], `Stufe ${i + 1} traegt weniger Regeln als Stufe ${i}`).toBeGreaterThanOrEqual(
        curve[i - 1]!,
      )
    }
    expect(curve[7]).toBeGreaterThan(curve[0]!)
  })

  it('widens the step size with difficulty', () => {
    const widest = (difficulty: number) => {
      let largest = 0
      for (let i = 0; i < 600; i++) {
        const parsed = parse(generateSeries(difficulty, createRng(i * 104729 + difficulty)).params)
        for (const rule of parsed.rules) largest = Math.max(largest, Math.abs(rule.step))
      }
      return largest
    }
    expect(widest(1)).toBe(1)
    expect(widest(2)).toBe(1)
    expect(widest(4)).toBe(2)
    expect(widest(8)).toBe(3)
  })

  it('always builds at least five principled distractors before any fallback', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const difficulty = (i % 8) + 1
      const config = buildConfig(difficulty, createRng(i * 2246822519 + 29))
      const pool = buildPool(config, buildFigures(config))
      expect(pool.length).toBeGreaterThanOrEqual(DISTRACTOR_COUNT)
    }
    const fallback = buildPool(FALLBACK_CONFIG, buildFigures(FALLBACK_CONFIG))
    expect(fallback.length).toBeGreaterThanOrEqual(DISTRACTOR_COUNT)
  })

  it('keeps every shape free of rotational and mirror symmetry', () => {
    for (const shape of SHAPES) {
      const seen = new Map<string, string>()
      for (let rotation = 0; rotation < 8; rotation++) {
        for (const mirror of [0, 1]) {
          const key = transformedPoints(SHAPE_POINTS[shape], rotation, mirror)
          expect(
            seen.has(key),
            `${shape} sieht bei ${rotation}/${mirror} aus wie bei ${seen.get(key)}`,
          ).toBe(false)
          seen.set(key, `${rotation}/${mirror}`)
        }
      }
      expect(seen.size).toBe(16)
    }
  })

  it('renders a distinct svg and a distinct text for every figure', () => {
    const seenSvg = new Map<string, string>()
    const seenText = new Map<string, string>()
    const all = everyFigure()
    for (const { shape, figure } of all) {
      const svg = figureToSvg(shape, figure)
      const text = describeFigure(shape, figure)
      const key = `${shape} ${figureKey(figure)}`
      expect(svg).toContain('currentColor')
      expect(svg).not.toMatch(/#[0-9a-fA-F]{3,6}/)
      expect(text).not.toContain('ß')
      expect(seenSvg.has(svg), `svg kollidiert: ${seenSvg.get(svg)} / ${key}`).toBe(false)
      expect(seenText.has(text), `Text kollidiert: ${seenText.get(text)} / ${key}`).toBe(false)
      seenSvg.set(svg, key)
      seenText.set(text, key)
    }
    expect(seenSvg.size).toBe(SHAPES.length * 8 * 2 * 6 * FILLS.length * 8)
    expect(seenText.size).toBe(seenSvg.size)
  })
})

describe('figurenreihen scoring', () => {
  const result = (correct: boolean, difficulty: number, rtMs = 7000) => ({
    idx: 0,
    itemType: 'reihe1-rotation',
    difficulty,
    params: { rules: [{ feature: 'rotation', step: 1 }] },
    response: 2,
    correct,
    rtMs,
    presentedAt: 0,
  })

  it('rewards the same accuracy at higher difficulty', () => {
    const easy = definition.score([result(true, 1), result(true, 1), result(false, 1)], 60)
    const hard = definition.score([result(true, 8), result(true, 8), result(false, 8)], 60)
    expect(easy.accuracy).toBe(hard.accuracy)
    expect(hard.raw).toBeGreaterThan(easy.raw)
  })

  it('reports zero for an empty session without throwing', () => {
    const score = definition.score([], 60)
    expect(score.raw).toBe(0)
    expect(score.accuracy).toBe(0)
    expect(score.metrics.medianRtMs).toBe(0)
    expect(score.metrics.meanRules).toBe(0)
  })

  it('counts the running transformations of the answered items', () => {
    const score = definition.score([result(true, 4), result(false, 4)], 60)
    expect(score.metrics.meanRules).toBe(1)
    expect(score.metrics.attempted).toBe(2)
    expect(score.metrics.correct).toBe(1)
  })
})
