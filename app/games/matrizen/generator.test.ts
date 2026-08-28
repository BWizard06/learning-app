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
  describeCell,
  generateMatrix,
  readsAsCopy,
  type CellFeatures,
  type FeatureKey,
  type MatrixPayload,
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

function mod(value: number, size: number): number {
  return ((value % size) + size) % size
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
  return wrap ? mod(a - b, size) : a - b
}

function ascending(values: number[]): number[] {
  return [...values].sort((a, b) => a - b)
}

function sameList(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function differingFeatures(a: CellFeatures, b: CellFeatures): FeatureKey[] {
  return FEATURE_KEYS.filter((feature) => a[feature] !== b[feature])
}

function cellKey(cell: CellFeatures): string {
  return FEATURE_KEYS.map((feature) => String(cell[feature])).join('|')
}

function ruleViolations(rule: StoredRule, matrix: CellFeatures[]): string[] {
  const feature = rule.feature
  const size = DOMAINS[feature].length
  const grid = gridOf(matrix, feature)
  const bad: string[] = []

  if (rule.kind === 'konstant') {
    if (new Set(grid.flat()).size !== 1) bad.push(`${feature} ist nicht konstant`)
    if (grid[0]![0] !== rule.value) bad.push(`${feature} steht nicht auf dem notierten Wert`)
    return bad
  }

  if (rule.kind === 'konstant-in-zeile') {
    for (let row = 0; row < 3; row++) {
      if (new Set(grid[row]!).size !== 1) bad.push(`${feature} Zeile ${row} ist nicht konstant`)
      if (grid[row]![0] !== rule.rows![row]) {
        bad.push(`${feature} Zeile ${row} steht nicht auf dem notierten Wert`)
      }
    }
    if (new Set(grid.map((line) => line[0]!)).size !== 3) {
      bad.push(`${feature} wiederholt eine Zeile`)
    }
    for (let col = 0; col < 3; col++) {
      const column = [grid[0]![col]!, grid[1]![col]!, grid[2]![col]!]
      if (new Set(column).size !== 3) bad.push(`${feature} Spalte ${col} wiederholt einen Wert`)
    }
    return bad
  }

  if (rule.kind === 'verteilung') {
    const expected = ascending(rule.values!)
    if (new Set(rule.values!).size !== 3) bad.push(`${feature} verteilt keine drei verschiedenen Werte`)
    for (let row = 0; row < 3; row++) {
      if (!sameList(ascending(grid[row]!), expected)) {
        bad.push(`${feature} Zeile ${row} traegt nicht jeden Wert genau einmal`)
      }
    }
    for (let col = 0; col < 3; col++) {
      const column = ascending([grid[0]![col]!, grid[1]![col]!, grid[2]![col]!])
      if (!sameList(column, expected)) {
        bad.push(`${feature} Spalte ${col} traegt nicht jeden Wert genau einmal`)
      }
    }
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        if (grid[row]![col] !== rule.values![mod(row * rule.rowShift! + col, 3)]) {
          bad.push(`${feature} folgt der notierten Verschiebung nicht`)
        }
      }
    }
    return bad
  }

  const wrap = rule.wrap === true
  const colStep = wrap ? mod(rule.colStep!, size) : rule.colStep!
  const rowShift = wrap ? mod(rule.rowShift!, size) : rule.rowShift!
  const start = wrap ? mod(rule.start!, size) : rule.start!

  if (grid[0]![0] !== start) bad.push(`${feature} startet nicht auf dem notierten Wert`)
  for (let row = 0; row < 3; row++) {
    if (step(grid[row]![1]!, grid[row]![0]!, size, wrap) !== colStep) {
      bad.push(`${feature} Zeile ${row} schreitet nicht wie notiert`)
    }
    if (step(grid[row]![2]!, grid[row]![1]!, size, wrap) !== colStep) {
      bad.push(`${feature} Zeile ${row} schreitet nicht wie notiert`)
    }
  }
  for (let col = 0; col < 3; col++) {
    if (step(grid[1]![col]!, grid[0]![col]!, size, wrap) !== rowShift) {
      bad.push(`${feature} Spalte ${col} schreitet nicht wie notiert`)
    }
    if (step(grid[2]![col]!, grid[1]![col]!, size, wrap) !== rowShift) {
      bad.push(`${feature} Spalte ${col} schreitet nicht wie notiert`)
    }
  }
  return bad
}

function fitsEveryRule(rules: StoredRule[], matrix: CellFeatures[]): boolean {
  return rules.every((rule) => ruleViolations(rule, matrix).length === 0)
}

describe('matrizen generator', () => {
  it('satisfies the shared generator contract', () => {
    runGeneratorContract(definition, {
      expectIntegerAnswer: true,
      minItemTypes: 6,
      checkTrial: (trial) => {
        const payload = trial.payload as MatrixPayload
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
      expect(parsed.rules).toHaveLength(FEATURE_KEYS.length)
      expect(parsed.rules.map((rule) => rule.feature)).toEqual([...FEATURE_KEYS])
      expect(parsed.matrix[8]).toEqual(solution)

      for (const rule of parsed.rules) {
        expect(ruleViolations(rule, parsed.matrix)).toEqual([])
      }
    }
  })

  it('leaves the correct option as the only one that completes the matrix', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const trial = generateMatrix((i % 10) + 1, createRng(i * 2246822519 + 37))
      const parsed = parse(trial.params)
      const head = parsed.matrix.slice(0, 8)

      const fitting = parsed.options
        .map((option, index) => (fitsEveryRule(parsed.rules, [...head, option]) ? index : -1))
        .filter((index) => index >= 0)

      expect(fitting, `Optionen ${fitting.join(',')} passen alle`).toEqual([parsed.correctIndex])
    }
  })

  it('shows the player exactly the matrix and the options that params describe', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const trial = generateMatrix((i % 10) + 1, createRng(i * 3266489917 + 41))
      const parsed = parse(trial.params)
      const payload = trial.payload as MatrixPayload

      expect(payload.cells).toEqual(parsed.matrix.slice(0, 8).map((cell) => cellToSvg(cell)))
      expect(trial.options!.map((option) => option.svg)).toEqual(
        parsed.options.map((cell) => cellToSvg(cell)),
      )
      expect(trial.options!.map((option) => option.label)).toEqual(
        parsed.options.map((cell) => describeCell(cell)),
      )
    }
  })

  it('keeps all six option feature vectors distinct', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const trial = generateMatrix((i % 10) + 1, createRng(i * 40503 + 7))
      const parsed = parse(trial.params)
      const vectors = parsed.options.map((cell) => cellKey(cell))
      expect(new Set(vectors).size).toBe(OPTION_COUNT)
      const svgs = trial.options!.map((option) => option.svg)
      expect(new Set(svgs).size).toBe(OPTION_COUNT)
      const labels = trial.options!.map((option) => option.label)
      expect(new Set(labels).size).toBe(OPTION_COUNT)
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
      const touched = new Set<string>()
      parsed.options.forEach((option, index) => {
        const source = parsed.sources[index]!
        if (index === parsed.correctIndex) {
          expect(source.source).toBe('loesung')
          expect(source.feature).toBe('keines')
          return
        }
        distractors++
        touched.add(source.feature)
        const changed = differingFeatures(option, solution)
        expect(changed, `option ${index} aendert ${changed.length} Merkmale`).toHaveLength(1)
        expect(changed[0]).toBe(source.feature)
        expect(kindOf.get(source.feature as FeatureKey)).not.toBe('konstant')
        expect(['links', 'oben', 'zeilenanfang', 'spaltenanfang', 'weiter']).toContain(source.source)
      })
      expect(distractors).toBe(DISTRACTOR_COUNT)
      expect(touched.size).toBeGreaterThanOrEqual(2)
    }
  })

  it('reads every distractor off the cell its recorded misreading names', () => {
    const runs = propertyRuns()
    const reference: Record<string, [number, number]> = {
      links: [2, 1],
      oben: [1, 2],
      zeilenanfang: [2, 0],
      spaltenanfang: [0, 2],
    }
    for (let i = 0; i < runs; i++) {
      const trial = generateMatrix((i % 10) + 1, createRng(i * 2654435769 + 53))
      const parsed = parse(trial.params)
      const ruleOf = new Map(parsed.rules.map((rule) => [rule.feature, rule]))
      parsed.options.forEach((option, index) => {
        const source = parsed.sources[index]!
        const feature = source.feature as FeatureKey
        const spot = reference[source.source]
        if (spot) {
          const neighbour = parsed.matrix[spot[0] * 3 + spot[1]]!
          expect(
            option[feature],
            `${source.source} muss den Wert aus Zelle ${spot.join(',')} tragen`,
          ).toBe(neighbour[feature])
          return
        }
        if (source.source !== 'weiter') return
        const rule = ruleOf.get(feature)!
        expect(rule.kind).toBe('progression')
        const size = DOMAINS[feature].length
        const grid = gridOf(parsed.matrix, feature)
        const beyond = grid[2]![2]! + rule.colStep!
        expect(
          indexOf(feature, option),
          'weiter muss einen Schritt hinter die Matrix greifen',
        ).toBe(rule.wrap ? mod(beyond, size) : beyond)
      })
    }
  })

  it('turns the shape only while it stays a triangle or a rhombus', () => {
    const runs = propertyRuns()
    let turning = 0
    for (let i = 0; i < runs; i++) {
      const trial = generateMatrix((i % 10) + 1, createRng(i * 1597334677 + 59))
      const parsed = parse(trial.params)
      const rotation = parsed.rules.find((rule) => rule.feature === 'rotation')!
      const angles = new Set([...parsed.matrix, ...parsed.options].map((cell) => cell.rotation))
      if (rotation.kind === 'konstant') {
        expect(angles.size).toBe(1)
        continue
      }
      turning++
      for (const cell of [...parsed.matrix, ...parsed.options]) {
        expect(['dreieck', 'raute'], 'gedrehte Formen muessen eindeutig bleiben').toContain(cell.shape)
      }
    }
    expect(turning).toBeGreaterThan(0)
  })

  it('never lets the missing cell repeat its left or its upper neighbour', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const trial = generateMatrix((i % 10) + 1, createRng(i * 433494437 + 61))
      const parsed = parse(trial.params)
      expect(cellKey(parsed.matrix[8]!)).not.toBe(cellKey(parsed.matrix[7]!))
      expect(cellKey(parsed.matrix[8]!)).not.toBe(cellKey(parsed.matrix[5]!))
    }
  })

  it('renders a distinct svg and a distinct description for every feature vector', () => {
    const seenSvg = new Map<string, string>()
    const seenText = new Map<string, string>()
    for (const shape of SHAPES) {
      for (const count of COUNTS) {
        for (const fill of FILLS) {
          for (const rotation of ROTATIONS) {
            for (const size of SIZES) {
              const features: CellFeatures = { shape, count, fill, rotation, size }
              const svg = cellToSvg(features)
              const text = describeCell(features)
              expect(svg).toBe(cellToSvg(features))
              expect(svg).toContain('currentColor')
              expect(svg).not.toMatch(/#[0-9a-fA-F]{3,6}/)
              expect(text).not.toContain('\u00df')
              const key = JSON.stringify(features)
              expect(seenSvg.has(svg), `svg kollidiert: ${seenSvg.get(svg)} / ${key}`).toBe(false)
              expect(seenText.has(text), `Text kollidiert: ${seenText.get(text)} / ${key}`).toBe(false)
              seenSvg.set(svg, key)
              seenText.set(text, key)
            }
          }
        }
      }
    }
    const total = SHAPES.length * COUNTS.length * FILLS.length * ROTATIONS.length * SIZES.length
    expect(seenSvg.size).toBe(total)
    expect(seenText.size).toBe(total)
  })

  it('keeps the fallback configuration usable', () => {
    expect(buildPool(FALLBACK_CONFIG).length).toBeGreaterThanOrEqual(DISTRACTOR_COUNT)
    expect(readsAsCopy(FALLBACK_CONFIG)).toBe(false)
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
    expect(seen.size).toBeGreaterThanOrEqual(6)
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
