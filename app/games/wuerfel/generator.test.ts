import { describe, expect, it } from 'vitest'
import { createRng } from '~~/shared/rng'
import { runGeneratorContract } from '~~/shared/testing/generator-contract'
import { propertyRuns } from '~~/shared/testing/property'
import definition from './definition'
import {
  BLANK,
  FACE_PERMUTATIONS,
  FALLBACK_FIGURES,
  ITEM_TYPES,
  MIRROR,
  MIRROR_KIND,
  NETZ_KINDS,
  NET_LAYOUTS,
  OPTION_COUNT,
  REBUILD_KIND,
  ROTATIONS,
  SOLUTION_KIND,
  applyPermutation,
  cubeSvg,
  facePermutation,
  figureSvg,
  foldNet,
  isChiral,
  matrixKey,
  netSvg,
  viewKeysOf,
  type Cell2,
  type Matrix3,
  type Vec3,
  type WuerfelPayload,
} from './generator'

type Grid = number[][]

const DIRS: number[][] = [
  [0, 0, 1],
  [0, 0, -1],
  [0, 1, 0],
  [0, -1, 0],
  [1, 0, 0],
  [-1, 0, 0],
]

const OPPOSITES: [number, number][] = [
  [0, 1],
  [2, 3],
  [4, 5],
]

function apply3(m: Grid, v: number[]): number[] {
  return [
    m[0]![0]! * v[0]! + m[0]![1]! * v[1]! + m[0]![2]! * v[2]!,
    m[1]![0]! * v[0]! + m[1]![1]! * v[1]! + m[1]![2]! * v[2]!,
    m[2]![0]! * v[0]! + m[2]![1]! * v[1]! + m[2]![2]! * v[2]!,
  ]
}

function mul3(a: Grid, b: Grid): Grid {
  const out: Grid = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      let sum = 0
      for (let k = 0; k < 3; k++) sum += a[r]![k]! * b[k]![c]!
      out[r]![c] = sum
    }
  }
  return out
}

function det3(m: Grid): number {
  return (
    m[0]![0]! * (m[1]![1]! * m[2]![2]! - m[1]![2]! * m[2]![1]!) -
    m[0]![1]! * (m[1]![0]! * m[2]![2]! - m[1]![2]! * m[2]![0]!) +
    m[0]![2]! * (m[1]![0]! * m[2]![1]! - m[1]![1]! * m[2]![0]!)
  )
}

function key3(m: Grid): string {
  return m.map((row) => row.join(',')).join(';')
}

function signedPermutationRotations(): Grid[] {
  const orders = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ]
  const out: Grid[] = []
  for (const order of orders) {
    for (let bits = 0; bits < 8; bits++) {
      const m: Grid = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ]
      for (let r = 0; r < 3; r++) m[r]![order[r]!] = bits & (1 << r) ? -1 : 1
      if (det3(m) === 1) out.push(m)
    }
  }
  return out
}

const INDEPENDENT_ROTATIONS = signedPermutationRotations()

function cross(a: number[], b: number[]): number[] {
  return [
    a[1]! * b[2]! - a[2]! * b[1]!,
    a[2]! * b[0]! - a[0]! * b[2]!,
    a[0]! * b[1]! - a[1]! * b[0]!,
  ]
}

function cornerTriples(): [number, number, number][] {
  const out: [number, number, number][] = []
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      for (let k = 0; k < 6; k++) {
        const turned = cross(DIRS[k]!, DIRS[j]!)
        const up = DIRS[i]!
        if (turned[0] !== up[0] || turned[1] !== up[1] || turned[2] !== up[2]) continue
        out.push([i, j, k])
      }
    }
  }
  return out
}

const CORNER_TRIPLES = cornerTriples()

function achievableViews(faces: readonly number[]): Set<string> {
  const out = new Set<string>()
  for (const [i, j, k] of CORNER_TRIPLES) out.add(`${faces[i]}|${faces[j]}|${faces[k]}`)
  return out
}

function normaliseTriples(cells: number[][]): number[][] {
  const minX = Math.min(...cells.map((cell) => cell[0]!))
  const minY = Math.min(...cells.map((cell) => cell[1]!))
  const minZ = Math.min(...cells.map((cell) => cell[2]!))
  return cells
    .map((cell) => [cell[0]! - minX, cell[1]! - minY, cell[2]! - minZ])
    .sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]! || a[2]! - b[2]!)
}

function shapeKey(cells: number[][]): string {
  return normaliseTriples(cells)
    .map((cell) => cell.join(','))
    .join(' ')
}

function orbitKeys(cells: number[][]): Set<string> {
  const out = new Set<string>()
  for (const m of INDEPENDENT_ROTATIONS) out.add(shapeKey(cells.map((cell) => apply3(m, cell))))
  return out
}

function sameShapeUpToRotation(a: number[][], b: number[][]): boolean {
  return orbitKeys(a).has(shapeKey(b))
}

function pairDistances(cells: number[][]): number[] {
  const out: number[] = []
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const p = cells[i]!
      const q = cells[j]!
      out.push((p[0]! - q[0]!) ** 2 + (p[1]! - q[1]!) ** 2 + (p[2]! - q[2]!) ** 2)
    }
  }
  return out.sort((a, b) => a - b)
}

function cellKey2(cell: readonly number[]): string {
  return `${cell[0]},${cell[1]}`
}

function normaliseShape2(cells: number[][]): number[][] {
  const minX = Math.min(...cells.map((cell) => cell[0]!))
  const minY = Math.min(...cells.map((cell) => cell[1]!))
  return cells
    .map((cell) => [cell[0]! - minX, cell[1]! - minY])
    .sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!)
}

function shape2Key(cells: number[][]): string {
  return normaliseShape2(cells)
    .map((cell) => cell.join(','))
    .join(' ')
}

function dihedralImages(cells: number[][]): number[][][] {
  const out: number[][][] = []
  let current = cells.map((cell) => [cell[0]!, cell[1]!])
  for (let flip = 0; flip < 2; flip++) {
    for (let turn = 0; turn < 4; turn++) {
      out.push(normaliseShape2(current))
      current = current.map((cell) => [-cell[1]!, cell[0]!])
    }
    current = current.map((cell) => [-cell[0]!, cell[1]!])
  }
  return out
}

function freeKey2(cells: number[][]): string {
  return dihedralImages(cells)
    .map((shape) => shape2Key(shape))
    .sort()[0]!
}

function fixedPolyominoes(size: number): number[][][] {
  let shapes = new Map<string, number[][]>()
  shapes.set('0,0', [[0, 0]])
  for (let step = 1; step < size; step++) {
    const next = new Map<string, number[][]>()
    for (const cells of shapes.values()) {
      const taken = new Set(cells.map((cell) => cellKey2(cell)))
      for (const cell of cells) {
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const grown = [cell[0]! + dx!, cell[1]! + dy!]
          if (taken.has(cellKey2(grown))) continue
          const shape = normaliseShape2([...cells, grown])
          next.set(shape2Key(shape), shape)
        }
      }
    }
    shapes = next
  }
  return [...shapes.values()]
}

function toCells2(cells: number[][]): Cell2[] {
  return cells.map((cell): Cell2 => [cell[0]!, cell[1]!])
}

type NetzParams = {
  type: string
  net: number[][]
  slots: number[]
  cellSymbols: number[]
  faces: number[]
  symbolCount: number
  kinds: string[]
  options: { view: number[] }[]
  correctIndex: number
}

type RotationParams = {
  type: string
  size: number
  figure: number[][]
  kinds: string[]
  options: { cells: number[][] }[]
  correctIndex: number
}

function netzOf(params: unknown): NetzParams {
  return params as unknown as NetzParams
}

function rotationOf(params: unknown): RotationParams {
  return params as unknown as RotationParams
}

describe('wuerfel rotation group', () => {
  it('collects exactly the twenty four proper rotations of a cube', () => {
    expect(ROTATIONS).toHaveLength(24)
    const built = new Set(ROTATIONS.map((m) => matrixKey(m as Matrix3)))
    expect(built.size).toBe(24)
    const independent = new Set(INDEPENDENT_ROTATIONS.map((m) => key3(m)))
    expect(independent.size).toBe(24)
    expect([...built].sort()).toEqual([...independent].sort())
  })

  it('holds only orthogonal matrices with determinant one', () => {
    for (const rotation of ROTATIONS) {
      const m = rotation as unknown as Grid
      expect(det3(m)).toBe(1)
      const product = mul3(m, [
        [m[0]![0]!, m[1]![0]!, m[2]![0]!],
        [m[0]![1]!, m[1]![1]!, m[2]![1]!],
        [m[0]![2]!, m[1]![2]!, m[2]![2]!],
      ])
      expect(product).toEqual([
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ])
    }
  })

  it('stays closed under composition and carries an inverse for every element', () => {
    const known = new Set(ROTATIONS.map((m) => matrixKey(m as Matrix3)))
    const identity = key3([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ])
    for (const a of ROTATIONS) {
      let inverses = 0
      for (const b of ROTATIONS) {
        const product = mul3(a as unknown as Grid, b as unknown as Grid)
        expect(known.has(key3(product)), `${key3(product)} fehlt in der Gruppe`).toBe(true)
        if (key3(product) === identity) inverses++
      }
      expect(inverses).toBe(1)
    }
  })

  it('keeps the reflection outside the rotation group', () => {
    expect(det3(MIRROR as unknown as Grid)).toBe(-1)
    const known = new Set(ROTATIONS.map((m) => matrixKey(m as Matrix3)))
    expect(known.has(matrixKey(MIRROR))).toBe(false)
    for (const rotation of ROTATIONS) {
      const product = mul3(MIRROR as unknown as Grid, rotation as unknown as Grid)
      expect(det3(product)).toBe(-1)
      expect(known.has(key3(product))).toBe(false)
    }
  })

  it('shows a labelled cube from twenty four corner views and never the reversed one', () => {
    const cube = [0, 1, 2, 3, 4, 5]
    expect(CORNER_TRIPLES).toHaveLength(24)
    const views = [...viewKeysOf(cube)]
    expect(views).toHaveLength(24)
    expect(new Set(views)).toEqual(achievableViews(cube))

    const corners = new Map<string, number>()
    for (const view of views) {
      const parts = view.split('|')
      const reversed = `${parts[0]}|${parts[2]}|${parts[1]}`
      expect(views, `Spiegelbild ${reversed} darf nicht vorkommen`).not.toContain(reversed)
      const unordered = [...parts].sort().join('+')
      corners.set(unordered, (corners.get(unordered) ?? 0) + 1)
    }
    expect(corners.size).toBe(8)
    for (const count of corners.values()) expect(count).toBe(3)
    for (const unordered of corners.keys()) {
      const slots = unordered.split('+').map(Number)
      for (const [a, b] of OPPOSITES) {
        expect(slots.includes(a) && slots.includes(b)).toBe(false)
      }
    }
  })

  it('never finds a mirrored cube inside the rotation group of the original', () => {
    const runs = Math.min(720, propertyRuns())
    const mirrorPerm = facePermutation(MIRROR)
    for (let i = 0; i < runs; i++) {
      const cube = createRng(i * 7919 + 5).shuffle([0, 1, 2, 3, 4, 5])
      const mirrored = applyPermutation(mirrorPerm, cube)
      const orbit = new Set(
        FACE_PERMUTATIONS.map((perm) => applyPermutation(perm, cube).join('|')),
      )
      expect(orbit.size).toBe(24)
      expect(orbit.has(mirrored.join('|'))).toBe(false)
      const views = viewKeysOf(cube)
      for (const view of viewKeysOf(mirrored)) {
        expect(views.has(view), `${view} liegt in beiden Wuerfeln`).toBe(false)
      }
    }
  })
})

describe('wuerfel net folding', () => {
  it('accepts exactly the eleven cube nets among all hexominoes', () => {
    const hexominoes = fixedPolyominoes(6)
    expect(hexominoes).toHaveLength(216)

    const foldable = new Set<string>()
    const fixedFoldable = new Set<string>()
    for (const shape of hexominoes) {
      if (!foldNet(toCells2(shape))) continue
      fixedFoldable.add(shape2Key(shape))
      foldable.add(freeKey2(shape))
    }
    expect(foldable.size).toBe(11)

    for (const shape of hexominoes) {
      const foldsUp = fixedFoldable.has(shape2Key(shape))
      for (const image of dihedralImages(shape)) {
        expect(
          fixedFoldable.has(shape2Key(image)),
          `gedrehtes Netz ${shape2Key(image)} wird anders beurteilt`,
        ).toBe(foldsUp)
      }
    }
  })

  it('folds every layout the game uses into six different faces', () => {
    const classes = new Set<string>()
    for (const layout of NET_LAYOUTS) {
      const slots = foldNet(layout)
      expect(slots, `Layout ${JSON.stringify(layout)} faltet nicht`).not.toBeNull()
      expect(new Set(slots!).size).toBe(6)
      expect([...slots!].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5])
      classes.add(freeKey2(layout.map((cell) => [cell[0], cell[1]])))
    }
    expect(classes.size).toBeGreaterThanOrEqual(4)
  })

  it('puts neighbouring fields on touching faces and fields two apart on opposite faces', () => {
    const oppositeOf = new Map<number, number>()
    for (const [a, b] of OPPOSITES) {
      oppositeOf.set(a, b)
      oppositeOf.set(b, a)
    }
    for (const shape of fixedPolyominoes(6)) {
      const layout = toCells2(shape)
      const slots = foldNet(layout)
      if (!slots) continue
      const at = new Map<string, number>()
      layout.forEach((cell, i) => at.set(cellKey2(cell), slots[i]!))

      for (const [key, slot] of at) {
        const parts = key.split(',').map(Number)
        for (const [dx, dy] of [
          [1, 0],
          [0, 1],
        ]) {
          const near = at.get(`${parts[0]! + dx!},${parts[1]! + dy!}`)
          if (near !== undefined) {
            expect(oppositeOf.get(slot), `${key} und der Nachbar duerfen nicht gegenueber liegen`).not.toBe(near)
          }
          const middle = at.get(`${parts[0]! + dx!},${parts[1]! + dy!}`)
          const far = at.get(`${parts[0]! + 2 * dx!},${parts[1]! + 2 * dy!}`)
          if (middle !== undefined && far !== undefined) {
            expect(far, `${key} und das Feld zwei weiter muessen gegenueber liegen`).toBe(
              oppositeOf.get(slot),
            )
          }
        }
      }
    }
  })
})

describe('wuerfel figures', () => {
  it('keeps every fallback figure chiral, connected and inside the drawing grid', () => {
    for (const [size, cells] of Object.entries(FALLBACK_FIGURES)) {
      expect(cells).toHaveLength(Number(size))
      expect(isChiral(cells)).toBe(true)
      const mirrored = cells.map((cell): Vec3 => [-cell[0], cell[1], cell[2]])
      expect(sameShapeUpToRotation(cells as unknown as number[][], mirrored as unknown as number[][])).toBe(false)
      for (const cell of cells) for (const value of cell) expect(value).toBeLessThan(3)
    }
  })
})

describe('wuerfel generator', () => {
  it('satisfies the shared generator contract', () => {
    runGeneratorContract(definition, {
      expectIntegerAnswer: true,
      minItemTypes: ITEM_TYPES.length,
      checkTrial: (trial) => {
        const payload = trial.payload as WuerfelPayload
        expect(payload.question.length).toBeGreaterThan(0)
        expect(payload.figure.startsWith('<svg')).toBe(true)
        expect(trial.options).toHaveLength(OPTION_COUNT)
        expect(trial.answer).toBe(trial.correctIndex)
      },
    })
  })

  it('offers exactly one foldable cube and three impossible ones', () => {
    const runs = propertyRuns()
    let seen = 0
    for (let i = 0; i < runs; i++) {
      const trial = definition.generate((i % 6) + 1, createRng(i * 2654435761 + 11))
      if (trial.itemType !== 'netz') continue
      seen++
      const params = netzOf(trial.params)

      params.slots.forEach((slot, index) => {
        expect(params.faces[slot]).toBe(params.cellSymbols[index])
      })
      expect(params.faces.filter((symbol) => symbol !== BLANK)).toHaveLength(params.symbolCount)

      const possible = achievableViews(params.faces)
      const views = params.options.map((option) => option.view.join('|'))
      expect(new Set(views).size).toBe(OPTION_COUNT)

      views.forEach((view, index) => {
        if (index === params.correctIndex) {
          expect(possible.has(view), `${view} muesste faltbar sein`).toBe(true)
          expect(params.kinds[index]).toBe(SOLUTION_KIND)
        } else {
          expect(possible.has(view), `${view} darf nicht faltbar sein`).toBe(false)
          expect(NETZ_KINDS).toContain(params.kinds[index])
        }
      })
    }
    expect(seen).toBeGreaterThan(runs / 4)
  })

  it('offers exactly one rotated copy of the shown figure and three different bodies', () => {
    const runs = propertyRuns()
    let seen = 0
    let mirrors = 0
    for (let i = 0; i < runs; i++) {
      const trial = definition.generate((i % 6) + 1, createRng(i * 2246822519 + 37))
      if (trial.itemType !== 'rotation') continue
      seen++
      const params = rotationOf(trial.params)
      const target = params.figure
      expect(target).toHaveLength(params.size)

      const orbit = orbitKeys(target)
      const keys: string[] = []

      params.options.forEach((option, index) => {
        expect(option.cells).toHaveLength(params.size)
        keys.push(shapeKey(option.cells))
        const belongs = orbit.has(shapeKey(option.cells))
        if (index === params.correctIndex) {
          expect(belongs, 'die Loesung muss eine Drehung der Figur sein').toBe(true)
          expect(params.kinds[index]).toBe(SOLUTION_KIND)
          expect(shapeKey(option.cells)).not.toBe(shapeKey(target))
        } else {
          expect(belongs, `Option ${index} darf keine Drehung sein`).toBe(false)
          expect([MIRROR_KIND, REBUILD_KIND]).toContain(params.kinds[index])
        }
        if (params.kinds[index] === MIRROR_KIND) {
          mirrors++
          expect(pairDistances(option.cells)).toEqual(pairDistances(target))
          const backMirrored = option.cells.map((cell) => [-cell[0]!, cell[1]!, cell[2]!])
          expect(sameShapeUpToRotation(backMirrored, target)).toBe(true)
        }
      })

      expect(new Set(keys).size).toBe(OPTION_COUNT)
      for (let a = 0; a < keys.length; a++) {
        for (let b = a + 1; b < keys.length; b++) {
          const left = params.options[a]!.cells
          const right = params.options[b]!.cells
          expect(
            sameShapeUpToRotation(left, right),
            `Option ${a} und ${b} sind dieselbe Figur`,
          ).toBe(false)
        }
      }
    }
    expect(seen).toBeGreaterThan(runs / 4)
    expect(mirrors).toBe(seen)
  })

  it('reaches both task formats and every distractor kind at the lowest difficulty', () => {
    const runs = propertyRuns()
    const formats = new Set<string>()
    const netzKinds = new Set<string>()
    const rotationKinds = new Set<string>()
    for (let i = 0; i < runs; i++) {
      const trial = definition.generate(1, createRng(i * 40503 + 7))
      formats.add(trial.itemType)
      const kinds = (trial.params as unknown as { kinds: string[] }).kinds
      for (const kind of kinds) {
        if (kind === SOLUTION_KIND) continue
        if (trial.itemType === 'netz') netzKinds.add(kind)
        else rotationKinds.add(kind)
      }
    }
    expect([...formats].sort()).toEqual([...ITEM_TYPES].sort())
    expect([...netzKinds].sort()).toEqual([...NETZ_KINDS].sort())
    expect([...rotationKinds].sort()).toEqual([MIRROR_KIND, REBUILD_KIND].sort())
  })

  it('carries more marked faces and more cubes as the difficulty rises', () => {
    const measure = (difficulty: number) => {
      let marked = 0
      let netz = 0
      let cubes = 0
      let bodies = 0
      for (let i = 0; i < 400; i++) {
        const trial = definition.generate(difficulty, createRng(i * 15485863 + difficulty))
        if (trial.itemType === 'netz') {
          netz++
          marked += netzOf(trial.params).faces.filter((symbol) => symbol !== BLANK).length
        } else {
          bodies++
          cubes += rotationOf(trial.params).figure.length
        }
      }
      return { marked: marked / Math.max(1, netz), cubes: cubes / Math.max(1, bodies) }
    }
    const easy = measure(1)
    const hard = measure(6)
    expect(easy.marked).toBe(4)
    expect(hard.marked).toBe(6)
    expect(easy.cubes).toBe(4)
    expect(hard.cubes).toBe(6)
  })

  it('draws every figure with theme colours and a spoken description', () => {
    const runs = Math.min(1200, propertyRuns())
    for (let i = 0; i < runs; i++) {
      const trial = definition.generate((i % 6) + 1, createRng(i * 3266489917 + 41))
      const payload = trial.payload as WuerfelPayload
      for (const svg of [payload.figure, ...trial.options!.map((option) => option.svg!)]) {
        expect(svg).toContain('currentColor')
        expect(svg).toContain('<title>')
        expect(svg).not.toMatch(/#[0-9a-fA-F]{3,6}/)
        expect(svg).not.toContain('ß')
        expect(svg.endsWith('</svg>')).toBe(true)
      }
    }
  })

  it('redraws the same picture for the same data', () => {
    const view = [0, 3, 5]
    expect(cubeSvg(view)).toBe(cubeSvg(view))
    const cells: Vec3[] = [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
    ]
    expect(figureSvg(cells)).toBe(figureSvg(cells))
    const net = NET_LAYOUTS[0]!
    expect(netSvg(net, [0, 1, 2, 3, 4, 5])).toBe(netSvg(net, [0, 1, 2, 3, 4, 5]))
    expect(netSvg(net, [0, 1, 2, 3, 4, 5])).not.toBe(netSvg(net, [1, 0, 2, 3, 4, 5]))
  })
})

describe('wuerfel scoring', () => {
  const result = (correct: boolean, difficulty: number, itemType = 'netz', rtMs = 7000) => ({
    idx: 0,
    itemType,
    difficulty,
    params: {},
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
    expect(hard.raw / easy.raw).toBeCloseTo(2.5, 6)
  })

  it('counts both task formats separately', () => {
    const score = definition.score(
      [
        result(true, 3, 'netz'),
        result(false, 3, 'netz'),
        result(true, 3, 'rotation'),
        result(true, 3, 'rotation'),
      ],
      60,
    )
    expect(score.metrics.netzGestellt).toBe(2)
    expect(score.metrics.netzGeloest).toBe(1)
    expect(score.metrics.rotationGestellt).toBe(2)
    expect(score.metrics.rotationGeloest).toBe(2)
    expect(score.metrics.attempted).toBe(4)
    expect(score.metrics.correct).toBe(3)
  })

  it('reports zero for an empty session without throwing', () => {
    const score = definition.score([], 60)
    expect(score.raw).toBe(0)
    expect(score.accuracy).toBe(0)
    expect(score.metrics.medianRtMs).toBe(0)
  })
})
