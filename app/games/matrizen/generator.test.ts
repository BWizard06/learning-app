import { describe, expect, it } from 'vitest'
import { createRng } from '~~/shared/rng'
import { runGeneratorContract } from '~~/shared/testing/generator-contract'
import { propertyRuns } from '~~/shared/testing/property'
import definition from './definition'
import {
  COUNTS,
  DISTRACTOR_COUNT,
  DOMAINS,
  FALLBACK_CONFIG,
  FEATURE_KEYS,
  FILLS,
  OPTION_COUNT,
  ROTATIONS,
  SHAPES,
  SIZES,
  buildPool,
  cellToSvg,
  generateMatrix,
  type CellFeatures,
  type FeatureKey,
} from './generator'

type StoredRule = {
  feature: FeatureKey
  kind: string
  value?: number
  rows?: number[]
  values?: number[]
  start?: number
  colStep?: number
  rowShift?: number
  wrap?: boolean
}

type StoredSource = { feature: string; source: string }

interface Parsed {
  rules: StoredRule[]
  matrix: CellFeatures[]
  options: CellFeatures[]
  sources: StoredSource[]
  correctIndex: number
}

function parse(params: unknown): Parsed {
  return params as unknown as Parsed
}

function indexOf(feature: FeatureKey, cell: CellFeatures): number {
  return DOMAINS[feature].indexOf(cell[feature] as string | number)
}

function gridOf(matrix: CellFeatures[], feature: FeatureKey): number[][] {
  const rows: number[][] = []
  for (let row = 0; row < 3; row++) {
    const line: number[] = []
    for (let col = 0; col < 3; col++) line.push(indexOf(feature, matrix[row * 3 + col]!))
    rows.push(line)
  }
  return rows
}

function step(a: number, b: number, size: number, wrap: boolean): number {
  return wrap ? ((a - b) % size + size) % size : a - b
}

function differingFeatures(a: CellFeatures, b: CellFeatures): FeatureKey[] {
  return FEATURE_KEYS.filter((feature) => a[feature] !== b[feature])
}

function expectRuleHolds(rule: StoredRule, matrix: CellFeatures[]): void {
  const feature = rule.feature
  const size = DOMAINS[feature].length
  const grid = gridOf(matrix, feature)
  const flat = grid.flat()

  if (rule.kind === 'konstant') {
    expect(new Set(flat).size, `${feature} muss konstant sein`).toBe(1)
    expect(flat[0]).toBe(rule.value)
    return
  }

  if (rule.kind === 'konstant-in-zeile') {
    for (let row = 0; row < 3; row++) {
      expect(new Set(grid[row]!).size, `${feature} Zeile ${row} nicht konstant`).toBe(1)
      expect(grid[row]![0]).toBe(rule.rows![row])
    }
    expect(new Set(grid.map((line) => line[0]!)).size, `${feature} Zeilen nicht verschieden`).toBe(3)
    for (let col = 0; col < 3; col++) {
      expect(new Set([grid[0]![col]!, grid[1]![col]!, grid[2]![col]!]).size).toBe(3)
    }
    return
  }

  if (rule.kind === 'verteilung') {
    const expected = [...rule.values!].sort((a, b) => a - b)
    for (let row = 0; row < 3; row++) {
      expect([...grid[row]!].sort((a, b) => a - b)).toEqual(expected)
    }
    for (let col = 0; col < 3; col++) {
      const column = [grid[0]![col]!, grid[1]![col]!, grid[2]![col]!].sort((a, b) => a - b)
      expect(column).toEqual(expected)
    }
    return
  }

  const wrap = rule.wrap === true
  const colStep = wrap ? ((rule.colStep! % size) + size) % size : rule.colStep!
  const rowShift = wrap ? ((rule.rowShift! % size) + size) % size : rule.rowShift!

  for (let row = 0; row < 3; row++) {
    expect(step(grid[row]![1]!, grid[row]![0]!, size, wrap)).toBe(colStep)
    expect(step(grid[row]![2]!, grid[row]![1]!, size, wrap)).toBe(colStep)
  }
  for (let col = 0; col < 3; col++) {
    expect(step(grid[1]![col]!, grid[0]![col]!, size, wrap)).toBe(rowShift)
    expect(step(grid[2]![col]!, grid[1]![col]!, size, wrap)).toBe(rowShift)
  }
}

describe('matrizen generator', () => {
  it('satisfies the shared generator contract', () => {
    runGeneratorContract(definition, {
      expectIntegerAnswer: true,
      minItemTypes: 4,
      checkTrial: (trial) => {
        const payload = trial.payload as { question: string; cells: string[] }
        expect(payload.cells).toHaveLength(8)
        for (const cell of payload.cells) expect(cell.startsWith('<svg')).toBe(true)
        expect(payload.question.length).toBeGreaterThan(0)
        expect(payload.question).not.toContain('\u00df')
        expect(trial.options).toHaveLength(OPTION_COUNT)
        for (const option of trial.options!) expect(option.svg?.startsWith('<svg')).toBe(true)
        expect(trial.answer).toBe(trial.correctIndex)
      },
    })
  })

  it('lets the correct option satisfy every rule in its row and its column', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const trial = generateMatrix((i % 10) + 1, createRng(i * 2654435761 + 11))
      const parsed = parse(trial.params)
      const solution = parsed.options[parsed.correctIndex]!

      expect(parsed.matrix).toHaveLength(9)
      expect(parsed.matrix[8]).toEqual(solution)

      for (const rule of parsed.rules) expectRuleHolds(rule, parsed.matrix)
    }
  })

  it('keeps all six option feature vectors distinct', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const trial = generateMatrix((i % 10) + 1, createRng(i * 40503 + 7))
      const parsed = parse(trial.params)
      const vectors = parsed.options.map((cell) => JSON.stringify(cell))
      expect(new Set(vectors).size).toBe(OPTION_COUNT)
      const svgs = trial.options!.map((option) => option.svg)
      expect(new Set(svgs).size).toBe(OPTION_COUNT)
    }
  })

  it('builds every distractor by perturbing exactly one rule bearing feature', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const trial = generateMatrix((i % 10) + 1, createRng(i * 104729 + 23))
      const parsed = parse(trial.params)
      const solution = parsed.options[parsed.correctIndex]!
      const kindOf = new Map(parsed.rules.map((rule) => [rule.feature, rule.kind]))

      let distractors = 0
      parsed.options.forEach((option, index) => {
        const source = parsed.sources[index]!
        if (index === parsed.correctIndex) {
          expect(source.source).toBe('loesung')
          expect(source.feature).toBe('keines')
          return
        }
        distractors++
        const changed = differingFeatures(option, solution)
        expect(changed, `option ${index} aendert ${changed.length} Merkmale`).toHaveLength(1)
        expect(changed[0]).toBe(source.feature)
        expect(kindOf.get(source.feature as FeatureKey)).not.toBe('konstant')
        expect(['links', 'oben', 'zeilenanfang', 'spaltenanfang', 'weiter']).toContain(source.source)
      })
      expect(distractors).toBe(DISTRACTOR_COUNT)
    }
  })

  it('renders a distinct svg for every possible feature vector', () => {
    const seen = new Map<string, string>()
    for (const shape of SHAPES) {
      for (const count of COUNTS) {
        for (const fill of FILLS) {
          for (const rotation of ROTATIONS) {
            for (const size of SIZES) {
              const features: CellFeatures = { shape, count, fill, rotation, size }
              const svg = cellToSvg(features)
              expect(svg).toBe(cellToSvg(features))
              expect(svg).toContain('currentColor')
              expect(svg).not.toMatch(/#[0-9a-fA-F]{3,6}/)
              const key = JSON.stringify(features)
              expect(seen.has(svg), `svg kollidiert: ${seen.get(svg)} / ${key}`).toBe(false)
              seen.set(svg, key)
            }
          }
        }
      }
    }
    expect(seen.size).toBe(SHAPES.length * COUNTS.length * FILLS.length * ROTATIONS.length * SIZES.length)
  })

  it('keeps the fallback configuration usable', () => {
    expect(buildPool(FALLBACK_CONFIG).length).toBeGreaterThanOrEqual(DISTRACTOR_COUNT)
  })

  it('raises the number of rule bearing features with difficulty', () => {
    const carriers = (difficulty: number) => {
      let total = 0
      for (let i = 0; i < 300; i++) {
        const trial = generateMatrix(difficulty, createRng(i * 7919 + difficulty))
        total += parse(trial.params).rules.filter((rule) => rule.kind !== 'konstant').length
      }
      return total / 300
    }
    expect(carriers(2)).toBe(2)
    expect(carriers(9)).toBe(3)
    expect(carriers(9)).toBeGreaterThan(carriers(2))
  })

  it('holds the distribution rule back until difficulty four', () => {
    const runs = propertyRuns()
    const seen = new Set<string>()
    for (let i = 0; i < runs; i++) {
      const difficulty = (i % 10) + 1
      const trial = generateMatrix(difficulty, createRng(i * 15485863 + 5))
      seen.add(trial.itemType)
      const kinds = parse(trial.params).rules.map((rule) => rule.kind)
      if (difficulty <= 3) expect(kinds).not.toContain('verteilung')
    }
    expect(seen.size).toBeGreaterThanOrEqual(4)
  })

  it('never mixes the two shapes that look alike when small', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const trial = generateMatrix((i % 10) + 1, createRng(i * 6700417 + 29))
      const parsed = parse(trial.params)
      const shapes = new Set([...parsed.matrix, ...parsed.options].map((cell) => cell.shape))
      expect(shapes.has('kreis') && shapes.has('sechseck')).toBe(false)
    }
  })

  it('never leaves a feature outside its domain', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const trial = generateMatrix((i % 10) + 1, createRng(i * 32452843 + 13))
      const parsed = parse(trial.params)
      for (const cell of [...parsed.matrix, ...parsed.options]) {
        for (const feature of FEATURE_KEYS) {
          expect(DOMAINS[feature].includes(cell[feature] as string | number)).toBe(true)
        }
      }
    }
  })
})

describe('matrizen scoring', () => {
  const result = (correct: boolean, difficulty: number, rtMs = 6000) => ({
    idx: 0,
    itemType: 'regeln2-progression',
    difficulty,
    params: {},
    response: 1,
    correct,
    rtMs,
    presentedAt: 0,
  })

  it('rewards the same accuracy at higher difficulty', () => {
    const easy = definition.score([result(true, 1), result(true, 1), result(false, 1)], 60)
    const hard = definition.score([result(true, 10), result(true, 10), result(false, 10)], 60)
    expect(easy.accuracy).toBe(hard.accuracy)
    expect(hard.raw).toBeGreaterThan(easy.raw)
  })

  it('reports zero for an empty session without throwing', () => {
    const score = definition.score([], 60)
    expect(score.raw).toBe(0)
    expect(score.accuracy).toBe(0)
    expect(score.metrics.medianRtMs).toBe(0)
  })
})
