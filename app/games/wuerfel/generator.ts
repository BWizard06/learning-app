import type { Rng } from '~~/shared/rng'
import type { ChoiceOption, JsonObject, Trial } from '~~/shared/types'

export type Vec3 = [number, number, number]
export type Matrix3 = [Vec3, Vec3, Vec3]
export type Cell2 = [number, number]

export const ITEM_TYPES = ['netz', 'rotation'] as const
export type ItemType = (typeof ITEM_TYPES)[number]

export const OPTION_COUNT = 4
export const DISTRACTOR_COUNT = OPTION_COUNT - 1
export const BLANK = -1
export const SLOT_COUNT = 6

export const IDENTITY: Matrix3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
]

export const ROT_X: Matrix3 = [
  [1, 0, 0],
  [0, 0, -1],
  [0, 1, 0],
]

export const ROT_Y: Matrix3 = [
  [0, 0, 1],
  [0, 1, 0],
  [-1, 0, 0],
]

export const ROT_Z: Matrix3 = [
  [0, -1, 0],
  [1, 0, 0],
  [0, 0, 1],
]

export const MIRROR: Matrix3 = [
  [-1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
]

export const SLOT_DIRS: Vec3[] = [
  [0, 0, 1],
  [0, 0, -1],
  [0, 1, 0],
  [0, -1, 0],
  [1, 0, 0],
  [-1, 0, 0],
]

export const OPPOSITE_SLOT: number[] = [1, 0, 3, 2, 5, 4]
export const VISIBLE_SLOTS: number[] = [0, 2, 4]

export function applyMatrix(m: Matrix3, v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ]
}

export function multiply(a: Matrix3, b: Matrix3): Matrix3 {
  const out: Matrix3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      let sum = 0
      for (let k = 0; k < 3; k++) sum += a[row]![k]! * b[k]![col]!
      out[row]![col] = sum
    }
  }
  return out
}

export function transpose(m: Matrix3): Matrix3 {
  return [
    [m[0][0], m[1][0], m[2][0]],
    [m[0][1], m[1][1], m[2][1]],
    [m[0][2], m[1][2], m[2][2]],
  ]
}

export function matrixKey(m: Matrix3): string {
  return `${m[0].join(',')};${m[1].join(',')};${m[2].join(',')}`
}

function buildRotationGroup(): Matrix3[] {
  const seen = new Set<string>([matrixKey(IDENTITY)])
  const queue: Matrix3[] = [IDENTITY]
  let head = 0
  while (head < queue.length) {
    const current = queue[head++]!
    for (const generator of [ROT_X, ROT_Y, ROT_Z]) {
      const next = multiply(generator, current)
      const key = matrixKey(next)
      if (seen.has(key)) continue
      seen.add(key)
      queue.push(next)
    }
  }
  return queue
}

export const ROTATIONS: Matrix3[] = buildRotationGroup()

function slotOfDir(v: Vec3): number {
  for (let i = 0; i < SLOT_DIRS.length; i++) {
    const dir = SLOT_DIRS[i]!
    if (dir[0] === v[0] && dir[1] === v[1] && dir[2] === v[2]) return i
  }
  return -1
}

export function facePermutation(m: Matrix3): number[] {
  const perm = [0, 0, 0, 0, 0, 0]
  for (let i = 0; i < SLOT_COUNT; i++) {
    perm[slotOfDir(applyMatrix(m, SLOT_DIRS[i]!))] = i
  }
  return perm
}

export const FACE_PERMUTATIONS: number[][] = ROTATIONS.map(facePermutation)

export function applyPermutation(perm: readonly number[], cube: readonly number[]): number[] {
  return perm.map((source) => cube[source]!)
}

export function viewOf(cube: readonly number[]): number[] {
  return VISIBLE_SLOTS.map((slot) => cube[slot]!)
}

export function viewKey(view: readonly number[]): string {
  return view.join('|')
}

export function orientationsOf(cube: readonly number[]): number[][] {
  return FACE_PERMUTATIONS.map((perm) => applyPermutation(perm, cube))
}

export function viewKeysOf(cube: readonly number[]): Set<string> {
  const out = new Set<string>()
  for (const oriented of orientationsOf(cube)) out.add(viewKey(viewOf(oriented)))
  return out
}

const ROLL_EAST = ROT_Y
const ROLL_WEST = transpose(ROT_Y)
const ROLL_SOUTH = ROT_X
const ROLL_NORTH = transpose(ROT_X)

const ROLL_STEPS: [number, number, Matrix3][] = [
  [1, 0, ROLL_EAST],
  [-1, 0, ROLL_WEST],
  [0, 1, ROLL_SOUTH],
  [0, -1, ROLL_NORTH],
]

export function foldNet(cells: readonly Cell2[]): number[] | null {
  if (cells.length !== SLOT_COUNT) return null
  const index = new Map<string, number>()
  cells.forEach((cell, i) => index.set(`${cell[0]},${cell[1]}`, i))
  if (index.size !== cells.length) return null

  const orientation: (Matrix3 | null)[] = cells.map(() => null)
  const slots: number[] = cells.map(() => -1)
  orientation[0] = IDENTITY
  slots[0] = facePermutation(IDENTITY)[1]!
  const queue = [0]
  let head = 0
  let visited = 1

  while (head < queue.length) {
    const at = queue[head++]!
    const cell = cells[at]!
    const here = orientation[at]!
    for (const [dx, dy, roll] of ROLL_STEPS) {
      const to = index.get(`${cell[0] + dx},${cell[1] + dy}`)
      if (to === undefined || orientation[to] !== null) continue
      const next = multiply(roll, here)
      orientation[to] = next
      slots[to] = facePermutation(next)[1]!
      queue.push(to)
      visited++
    }
  }

  if (visited !== cells.length) return null
  if (new Set(slots).size !== SLOT_COUNT) return null
  return slots
}

export const NET_LAYOUTS: Cell2[][] = [
  [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [1, 2],
    [1, 3],
  ],
  [
    [0, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1],
    [1, 2],
  ],
  [
    [0, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1],
    [2, 2],
  ],
  [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1],
    [0, 2],
  ],
  [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1],
    [2, 2],
  ],
  [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1],
    [3, 2],
  ],
  [
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1],
    [0, 2],
  ],
  [
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1],
    [3, 2],
  ],
  [
    [3, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1],
    [2, 2],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [2, 1],
    [3, 1],
    [4, 1],
  ],
  [
    [2, 0],
    [3, 0],
    [4, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
    [2, 2],
    [3, 2],
  ],
  [
    [1, 0],
    [2, 0],
    [1, 1],
    [0, 1],
    [0, 2],
    [-1, 2],
  ],
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
    [1, 2],
    [1, 3],
  ],
]

export const SYMBOLS = [
  'kreis',
  'punkt',
  'quadrat',
  'raute',
  'plus',
  'kreuz',
  'ring',
  'vier',
] as const

export type SymbolName = (typeof SYMBOLS)[number]

const SYMBOL_LABELS: string[] = [
  'Kreis',
  'Punkt',
  'Quadrat',
  'Raute',
  'Plus',
  'Kreuz',
  'Ring',
  'Vierpunkt',
]

const SYMBOL_MARKUP: string[] = [
  '<circle cx="0.5" cy="0.5" r="0.28"/>',
  '<circle cx="0.5" cy="0.5" r="0.24" fill="currentColor" fill-opacity="0.85"/>',
  '<rect x="0.23" y="0.23" width="0.54" height="0.54"/>',
  '<polygon points="0.5,0.17 0.83,0.5 0.5,0.83 0.17,0.5"/>',
  '<path d="M0.5 0.18V0.82M0.18 0.5H0.82"/>',
  '<path d="M0.26 0.26L0.74 0.74M0.74 0.26L0.26 0.74"/>',
  '<circle cx="0.5" cy="0.5" r="0.31"/><circle cx="0.5" cy="0.5" r="0.11" fill="currentColor" fill-opacity="0.85"/>',
  '<circle cx="0.3" cy="0.3" r="0.1" fill="currentColor" fill-opacity="0.85"/><circle cx="0.7" cy="0.3" r="0.1" fill="currentColor" fill-opacity="0.85"/><circle cx="0.7" cy="0.7" r="0.1" fill="currentColor" fill-opacity="0.85"/><circle cx="0.3" cy="0.7" r="0.1" fill="currentColor" fill-opacity="0.85"/>',
]

export function symbolLabel(symbol: number): string {
  return symbol === BLANK ? 'leer' : SYMBOL_LABELS[symbol]!
}

const COS30 = Math.sqrt(3) / 2
const SIN30 = 0.5

export function projectIso(point: Vec3): [number, number] {
  return [(point[0] - point[1]) * COS30, (point[0] + point[1]) * SIN30 - point[2]]
}

interface Frame {
  scale: number
  dx: number
  dy: number
}

function fmt(value: number): string {
  return String(Math.round(value * 10) / 10)
}

function cornersOf(cells: readonly Vec3[]): Vec3[] {
  const out: Vec3[] = []
  for (const cell of cells) {
    for (let dx = 0; dx < 2; dx++) {
      for (let dy = 0; dy < 2; dy++) {
        for (let dz = 0; dz < 2; dz++) {
          out.push([cell[0] + dx, cell[1] + dy, cell[2] + dz])
        }
      }
    }
  }
  return out
}

function frameFor(points: readonly Vec3[], pad: number): Frame {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const point of points) {
    const flat = projectIso(point)
    if (flat[0] < minX) minX = flat[0]
    if (flat[0] > maxX) maxX = flat[0]
    if (flat[1] < minY) minY = flat[1]
    if (flat[1] > maxY) maxY = flat[1]
  }
  const width = Math.max(0.001, maxX - minX)
  const height = Math.max(0.001, maxY - minY)
  const span = 100 - 2 * pad
  const scale = Math.min(span / width, span / height)
  return {
    scale,
    dx: 50 - (scale * (minX + maxX)) / 2,
    dy: 50 - (scale * (minY + maxY)) / 2,
  }
}

function place(frame: Frame, point: Vec3): [number, number] {
  const flat = projectIso(point)
  return [frame.dx + frame.scale * flat[0], frame.dy + frame.scale * flat[1]]
}

type Quad = [Vec3, Vec3, Vec3, Vec3]

function topQuad(cell: Vec3): Quad {
  const [x, y, z] = cell
  return [
    [x, y, z + 1],
    [x + 1, y, z + 1],
    [x + 1, y + 1, z + 1],
    [x, y + 1, z + 1],
  ]
}

function leftQuad(cell: Vec3): Quad {
  const [x, y, z] = cell
  return [
    [x, y + 1, z + 1],
    [x + 1, y + 1, z + 1],
    [x + 1, y + 1, z],
    [x, y + 1, z],
  ]
}

function rightQuad(cell: Vec3): Quad {
  const [x, y, z] = cell
  return [
    [x + 1, y, z + 1],
    [x + 1, y + 1, z + 1],
    [x + 1, y + 1, z],
    [x + 1, y, z],
  ]
}

function quadPoints(frame: Frame, quad: Quad): string {
  return quad
    .map((point) => {
      const flat = place(frame, point)
      return `${fmt(flat[0])},${fmt(flat[1])}`
    })
    .join(' ')
}

function quadMatrix(frame: Frame, quad: Quad): string {
  const origin = place(frame, quad[0])
  const along = place(frame, quad[1])
  const down = place(frame, quad[3])
  return `matrix(${fmt(along[0] - origin[0])} ${fmt(along[1] - origin[1])} ${fmt(down[0] - origin[0])} ${fmt(down[1] - origin[1])} ${fmt(origin[0])} ${fmt(origin[1])})`
}

function symbolGroup(symbol: number, transform: string): string {
  if (symbol === BLANK) return ''
  return `<g transform="${transform}" stroke-width="0.085" stroke-linecap="round">${SYMBOL_MARKUP[symbol]}</g>`
}

const FACE_TINTS = [0.12, 0.27, 0.44]

const HULL_OFFSETS: Vec3[] = [
  [0, 0, 1],
  [1, 0, 1],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 1, 1],
]

function hullMarkup(frame: Frame, cell: Vec3): string {
  const points = HULL_OFFSETS.map((offset) => {
    const flat = place(frame, [cell[0] + offset[0], cell[1] + offset[1], cell[2] + offset[2]])
    return `${fmt(flat[0])},${fmt(flat[1])}`
  }).join(' ')
  return `<polygon points="${points}" fill="var(--raised)" stroke="none"/>`
}

function faceMarkup(frame: Frame, quad: Quad, tint: number, symbol: number): string {
  return `<polygon points="${quadPoints(frame, quad)}" fill="currentColor" fill-opacity="${tint}"/>${symbolGroup(symbol, quadMatrix(frame, quad))}`
}

function svgWrap(body: string, title: string): string {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"><title>${title}</title>${body}</svg>`
}

export function describeView(view: readonly number[]): string {
  return `Würfel mit ${symbolLabel(view[0]!)} oben, ${symbolLabel(view[1]!)} links, ${symbolLabel(view[2]!)} rechts`
}

export function cubeSvg(view: readonly number[]): string {
  const cell: Vec3 = [0, 0, 0]
  const frame = frameFor(cornersOf([cell]), 12)
  const body = [
    hullMarkup(frame, cell),
    faceMarkup(frame, topQuad(cell), FACE_TINTS[0]!, view[0]!),
    faceMarkup(frame, leftQuad(cell), FACE_TINTS[1]!, view[1]!),
    faceMarkup(frame, rightQuad(cell), FACE_TINTS[2]!, view[2]!),
  ].join('')
  return svgWrap(body, describeView(view))
}

export function describeFigure(cells: readonly Vec3[]): string {
  const width = Math.max(...cells.map((cell) => cell[0])) + 1
  const depth = Math.max(...cells.map((cell) => cell[1])) + 1
  const height = Math.max(...cells.map((cell) => cell[2])) + 1
  return `Figur aus ${cells.length} Würfeln, ${width} breit, ${depth} tief, ${height} hoch`
}

export function figureSvg(cells: readonly Vec3[]): string {
  const frame = frameFor(cornersOf(cells), 9)
  const ordered = cells.slice().sort((a, b) => {
    const depth = a[0] + a[1] + a[2] - (b[0] + b[1] + b[2])
    if (depth !== 0) return depth
    if (a[0] !== b[0]) return a[0] - b[0]
    if (a[1] !== b[1]) return a[1] - b[1]
    return a[2] - b[2]
  })
  const filled = new Set(cells.map((cell) => cell.join(',')))
  const body = ordered
    .map((cell) => {
      let out = hullMarkup(frame, cell)
      if (!filled.has(`${cell[0]},${cell[1]},${cell[2] + 1}`)) {
        out += faceMarkup(frame, topQuad(cell), FACE_TINTS[0]!, BLANK)
      }
      if (!filled.has(`${cell[0]},${cell[1] + 1},${cell[2]}`)) {
        out += faceMarkup(frame, leftQuad(cell), FACE_TINTS[1]!, BLANK)
      }
      if (!filled.has(`${cell[0] + 1},${cell[1]},${cell[2]}`)) {
        out += faceMarkup(frame, rightQuad(cell), FACE_TINTS[2]!, BLANK)
      }
      return out
    })
    .join('')
  return svgWrap(body, describeFigure(cells))
}

export function describeNet(cells: readonly Cell2[], symbols: readonly number[]): string {
  const named = symbols.filter((symbol) => symbol !== BLANK).map((symbol) => symbolLabel(symbol))
  return `Netz aus ${cells.length} Feldern mit ${named.join(', ')}`
}

export function netSvg(cells: readonly Cell2[], symbols: readonly number[]): string {
  const cols = cells.map((cell) => cell[0])
  const rows = cells.map((cell) => cell[1])
  const minCol = Math.min(...cols)
  const minRow = Math.min(...rows)
  const width = Math.max(...cols) - minCol + 1
  const height = Math.max(...rows) - minRow + 1
  const pad = 8
  const span = 100 - 2 * pad
  const scale = Math.min(span / width, span / height)
  const dx = 50 - (scale * width) / 2
  const dy = 50 - (scale * height) / 2

  const body = cells
    .map((cell, i) => {
      const x = dx + scale * (cell[0] - minCol)
      const y = dy + scale * (cell[1] - minRow)
      const square = `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(scale)}" height="${fmt(scale)}" fill="currentColor" fill-opacity="0.08"/>`
      const transform = `matrix(${fmt(scale)} 0 0 ${fmt(scale)} ${fmt(x)} ${fmt(y)})`
      return square + symbolGroup(symbols[i]!, transform)
    })
    .join('')

  return svgWrap(body, describeNet(cells, symbols))
}

export function normaliseCells(cells: readonly Vec3[]): Vec3[] {
  const minX = Math.min(...cells.map((cell) => cell[0]))
  const minY = Math.min(...cells.map((cell) => cell[1]))
  const minZ = Math.min(...cells.map((cell) => cell[2]))
  return cells
    .map((cell): Vec3 => [cell[0] - minX, cell[1] - minY, cell[2] - minZ])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])
}

export function rotateCells(m: Matrix3, cells: readonly Vec3[]): Vec3[] {
  return cells.map((cell) => applyMatrix(m, cell))
}

export function mirrorCells(cells: readonly Vec3[]): Vec3[] {
  return normaliseCells(rotateCells(MIRROR, cells))
}

export const GRID_SPAN = 3

export function fitsGrid(cells: readonly Vec3[]): boolean {
  return cells.every((cell) => cell.every((value) => value >= 0 && value < GRID_SPAN))
}

export function maskOf(cells: readonly Vec3[]): number {
  let mask = 0
  for (const cell of cells) {
    mask |= 1 << (cell[0] * 9 + cell[1] * 3 + cell[2])
  }
  return mask >>> 0
}

export function canonicalMask(cells: readonly Vec3[]): number {
  let best = -1
  const xs: number[] = []
  const ys: number[] = []
  const zs: number[] = []
  for (const rotation of ROTATIONS) {
    let minX = Infinity
    let minY = Infinity
    let minZ = Infinity
    xs.length = 0
    ys.length = 0
    zs.length = 0
    for (const cell of cells) {
      const turned = applyMatrix(rotation, cell)
      xs.push(turned[0])
      ys.push(turned[1])
      zs.push(turned[2])
      if (turned[0] < minX) minX = turned[0]
      if (turned[1] < minY) minY = turned[1]
      if (turned[2] < minZ) minZ = turned[2]
    }
    let mask = 0
    for (let i = 0; i < xs.length; i++) {
      mask |= 1 << ((xs[i]! - minX) * 9 + (ys[i]! - minY) * 3 + (zs[i]! - minZ))
    }
    mask = mask >>> 0
    if (best < 0 || mask < best) best = mask
  }
  return best
}

export function isChiral(cells: readonly Vec3[]): boolean {
  return canonicalMask(cells) !== canonicalMask(mirrorCells(cells))
}

function neighboursOf(cell: Vec3): Vec3[] {
  return SLOT_DIRS.map((dir): Vec3 => [cell[0] + dir[0], cell[1] + dir[1], cell[2] + dir[2]])
}

function isConnected(cells: readonly Vec3[]): boolean {
  if (cells.length === 0) return false
  const keys = new Set(cells.map((cell) => cell.join(',')))
  const seen = new Set<string>([cells[0]!.join(',')])
  const queue: Vec3[] = [cells[0]!]
  let head = 0
  while (head < queue.length) {
    const at = queue[head++]!
    for (const next of neighboursOf(at)) {
      const key = next.join(',')
      if (!keys.has(key) || seen.has(key)) continue
      seen.add(key)
      queue.push(next)
    }
  }
  return seen.size === cells.length
}

export function distanceSignature(cells: readonly Vec3[]): number[] {
  const out: number[] = []
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const a = cells[i]!
      const b = cells[j]!
      const dx = a[0] - b[0]
      const dy = a[1] - b[1]
      const dz = a[2] - b[2]
      out.push(dx * dx + dy * dy + dz * dz)
    }
  }
  return out.sort((a, b) => a - b)
}

export function signatureOverlap(a: readonly number[], b: readonly number[]): number {
  let i = 0
  let j = 0
  let shared = 0
  while (i < a.length && j < b.length) {
    if (a[i]! === b[j]!) {
      shared++
      i++
      j++
    } else if (a[i]! < b[j]!) i++
    else j++
  }
  return shared
}

export function rebuildCandidates(cells: readonly Vec3[]): Vec3[][] {
  const out: Vec3[][] = []
  for (let i = 0; i < cells.length; i++) {
    const rest = cells.filter((_, index) => index !== i)
    if (!isConnected(rest)) continue
    const restKeys = new Set(rest.map((cell) => cell.join(',')))
    const spots = new Set<string>()
    for (const cell of rest) {
      for (const next of neighboursOf(cell)) {
        const key = next.join(',')
        if (restKeys.has(key)) continue
        spots.add(key)
      }
    }
    for (const key of [...spots].sort()) {
      const parts = key.split(',').map(Number)
      const moved: Vec3 = [parts[0]!, parts[1]!, parts[2]!]
      const candidate = normaliseCells([...rest, moved])
      if (!fitsGrid(candidate)) continue
      out.push(candidate)
    }
  }
  return out
}

function levelOf(difficulty: number): number {
  return Math.min(5, Math.max(0, Math.round(difficulty) - 1))
}

const SYMBOL_COUNTS = [4, 4, 5, 5, 6, 6]
const CUBE_COUNTS = [4, 4, 5, 5, 6, 6]

export function symbolCountFor(difficulty: number): number {
  return SYMBOL_COUNTS[levelOf(difficulty)]!
}

export function cubeCountFor(difficulty: number): number {
  return CUBE_COUNTS[levelOf(difficulty)]!
}

function tension(difficulty: number): number {
  return levelOf(difficulty) / 5
}

export const NETZ_KINDS = ['spiegel', 'getauscht', 'gegenueber', 'fremd'] as const
export type NetzKind = (typeof NETZ_KINDS)[number]

export const SOLUTION_KIND = 'loesung'
export const MIRROR_KIND = 'spiegel'
export const REBUILD_KIND = 'umgebaut'

export function netzWeights(difficulty: number): [NetzKind, number][] {
  const t = tension(difficulty)
  return [
    ['spiegel', 1 + 3 * t],
    ['getauscht', 1 + 2 * t],
    ['gegenueber', 2],
    ['fremd', 1 + 3 * (1 - t)],
  ]
}

const NETZ_QUESTION = 'Welcher Würfel entsteht aus diesem Netz?'
const ROTATION_QUESTION = 'Welche Figur ist dieselbe, nur gedreht?'

export interface WuerfelPayload {
  question: string
  figure: string
}

export type WuerfelTrial = Trial<WuerfelPayload, number>

interface OptionDraft {
  kind: string
  svg: string
  label: string
  data: JsonObject
}

function assemble(
  itemType: ItemType,
  difficulty: number,
  question: string,
  figure: string,
  drafts: OptionDraft[],
  extra: JsonObject,
  rng: Rng,
): WuerfelTrial {
  const shuffled = rng.shuffle(drafts)
  const correctIndex = shuffled.findIndex((draft) => draft.kind === SOLUTION_KIND)
  const options: ChoiceOption[] = shuffled.map((draft, index) => ({
    id: `feld-${index}`,
    label: draft.label,
    svg: draft.svg,
  }))
  return {
    itemType,
    difficulty,
    params: {
      type: itemType,
      ...extra,
      kinds: shuffled.map((draft) => draft.kind),
      options: shuffled.map((draft) => draft.data),
      correctIndex,
    },
    payload: { question, figure },
    answer: correctIndex,
    options,
    correctIndex,
  }
}

function buildNetz(difficulty: number, rng: Rng): WuerfelTrial | null {
  const cells = rng.pick(NET_LAYOUTS).map((cell): Cell2 => [cell[0], cell[1]])
  const slots = foldNet(cells)
  if (!slots) return null

  const symbolCount = symbolCountFor(difficulty)
  const allSymbols = SYMBOLS.map((_, index) => index)
  const chosen = rng.sample(allSymbols, symbolCount)
  const spares = allSymbols.filter((index) => !chosen.includes(index))
  const order = rng.shuffle([0, 1, 2, 3, 4, 5])

  const faces = [BLANK, BLANK, BLANK, BLANK, BLANK, BLANK]
  chosen.forEach((symbol, i) => {
    faces[order[i]!] = symbol
  })

  const cellSymbols = slots.map((slot) => faces[slot]!)
  const oriented = orientationsOf(faces)
  const known = viewKeysOf(faces)

  const richness = oriented.map((cube) => viewOf(cube).filter((symbol) => symbol !== BLANK).length)
  const best = Math.max(...richness)
  const bestIndices = richness
    .map((value, index) => (value === best ? index : -1))
    .filter((index) => index >= 0)
  const rotated = oriented[rng.pick(bestIndices)]!
  const solution = viewOf(rotated)

  const pools = new Map<NetzKind, number[][]>()
  const push = (kind: NetzKind, view: number[]) => {
    if (known.has(viewKey(view))) return
    const bucket = pools.get(kind)
    if (bucket) bucket.push(view)
    else pools.set(kind, [view])
  }

  push('spiegel', [solution[0]!, solution[2]!, solution[1]!])
  push('getauscht', [solution[1]!, solution[0]!, solution[2]!])
  push('getauscht', [solution[2]!, solution[1]!, solution[0]!])
  push('gegenueber', [rotated[1]!, solution[1]!, solution[2]!])
  push('gegenueber', [solution[0]!, rotated[3]!, solution[2]!])
  push('gegenueber', [solution[0]!, solution[1]!, rotated[5]!])
  for (const spare of spares) {
    push('fremd', [spare, solution[1]!, solution[2]!])
    push('fremd', [solution[0]!, spare, solution[2]!])
    push('fremd', [solution[0]!, solution[1]!, spare])
  }

  for (const [kind, bucket] of pools) pools.set(kind, rng.shuffle(bucket))

  const used = new Set<string>([viewKey(solution)])
  const picked: { kind: NetzKind; view: number[] }[] = []
  const take = (kind: NetzKind) => {
    const bucket = pools.get(kind)
    if (!bucket || bucket.length === 0) return
    const view = bucket.pop()!
    const key = viewKey(view)
    if (used.has(key)) return
    used.add(key)
    picked.push({ kind, view })
  }

  for (let guard = 0; guard < 96 && picked.length < DISTRACTOR_COUNT; guard++) {
    const live = netzWeights(difficulty).filter(([kind]) => (pools.get(kind)?.length ?? 0) > 0)
    if (live.length === 0) break
    take(rng.weighted(live))
  }
  for (const kind of NETZ_KINDS) {
    while (picked.length < DISTRACTOR_COUNT && (pools.get(kind)?.length ?? 0) > 0) take(kind)
  }
  if (picked.length < DISTRACTOR_COUNT) return null

  const drafts: OptionDraft[] = [
    {
      kind: SOLUTION_KIND,
      svg: cubeSvg(solution),
      label: describeView(solution),
      data: { view: solution },
    },
    ...picked.map((entry) => ({
      kind: entry.kind as string,
      svg: cubeSvg(entry.view),
      label: describeView(entry.view),
      data: { view: entry.view } as JsonObject,
    })),
  ]

  return assemble(
    'netz',
    difficulty,
    NETZ_QUESTION,
    netSvg(cells, cellSymbols),
    drafts,
    {
      net: cells.map((cell) => [cell[0], cell[1]]),
      slots,
      cellSymbols,
      faces,
      symbolCount,
    },
    rng,
  )
}

function growFigure(rng: Rng, size: number): Vec3[] | null {
  const cells: Vec3[] = [[0, 0, 0]]
  const taken = new Set<string>(['0,0,0'])
  for (let guard = 0; guard < 120 && cells.length < size; guard++) {
    const base = rng.pick(cells)
    const dir = rng.pick(SLOT_DIRS)
    const next: Vec3 = [base[0] + dir[0], base[1] + dir[1], base[2] + dir[2]]
    const key = next.join(',')
    if (taken.has(key)) continue
    taken.add(key)
    cells.push(next)
  }
  if (cells.length < size) return null
  const normalised = normaliseCells(cells)
  if (!fitsGrid(normalised)) return null
  if (!isChiral(normalised)) return null
  return normalised
}

export const FALLBACK_FIGURES: Record<number, Vec3[]> = {
  4: [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [1, 1, 1],
  ],
  5: [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [1, 1, 1],
    [2, 1, 1],
  ],
  6: [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [1, 1, 1],
    [2, 1, 1],
    [2, 2, 1],
  ],
}

function orientedTo(cells: readonly Vec3[], rng: Rng, avoid: number): Vec3[] {
  const order = rng.shuffle(ROTATIONS.map((_, index) => index))
  for (const index of order) {
    const candidate = normaliseCells(rotateCells(ROTATIONS[index]!, cells))
    if (maskOf(candidate) !== avoid) return candidate
  }
  return normaliseCells(cells)
}

function buildRotation(difficulty: number, rng: Rng): WuerfelTrial | null {
  const size = cubeCountFor(difficulty)
  let base: Vec3[] | null = null
  for (let attempt = 0; attempt < 40 && !base; attempt++) base = growFigure(rng, size)
  if (!base) base = FALLBACK_FIGURES[size]!

  const baseCanonical = canonicalMask(base)
  const mirrored = mirrorCells(base)
  const mirrorCanonical = canonicalMask(mirrored)
  if (mirrorCanonical === baseCanonical) return null

  const shown = orientedTo(base, rng, -1)
  const solution = orientedTo(base, rng, maskOf(shown))

  const baseSignature = distanceSignature(base)
  const t = tension(difficulty)
  const seenCanonical = new Set<number>([baseCanonical, mirrorCanonical])

  const ranked = rebuildCandidates(base)
    .map((candidate) => ({
      candidate,
      mask: maskOf(candidate),
      overlap: signatureOverlap(baseSignature, distanceSignature(candidate)),
    }))
    .sort((a, b) => {
      const byOverlap = t >= 0.5 ? b.overlap - a.overlap : a.overlap - b.overlap
      if (byOverlap !== 0) return byOverlap
      return a.mask - b.mask
    })

  const rebuilds: Vec3[][] = []
  for (const entry of ranked) {
    const canonical = canonicalMask(entry.candidate)
    if (seenCanonical.has(canonical)) continue
    seenCanonical.add(canonical)
    rebuilds.push(entry.candidate)
    if (rebuilds.length === 2) break
  }
  if (rebuilds.length < 2) return null

  const wrong = [mirrored, ...rebuilds].map((cells, index) => {
    const shape = orientedTo(cells, rng, -1)
    return {
      kind: index === 0 ? MIRROR_KIND : REBUILD_KIND,
      svg: figureSvg(shape),
      label: describeFigure(shape),
      data: { cells: shape.map((cell) => [cell[0], cell[1], cell[2]]) } as JsonObject,
    }
  })

  const drafts: OptionDraft[] = [
    {
      kind: SOLUTION_KIND,
      svg: figureSvg(solution),
      label: describeFigure(solution),
      data: { cells: solution.map((cell) => [cell[0], cell[1], cell[2]]) },
    },
    ...wrong,
  ]

  return assemble(
    'rotation',
    difficulty,
    ROTATION_QUESTION,
    figureSvg(shown),
    drafts,
    {
      size,
      figure: shown.map((cell) => [cell[0], cell[1], cell[2]]),
    },
    rng,
  )
}

export function generateWuerfel(difficulty: number, rng: Rng): WuerfelTrial {
  const builders = rng.bool(0.5)
    ? [buildNetz, buildRotation]
    : [buildRotation, buildNetz]
  for (const build of builders) {
    for (let attempt = 0; attempt < 16; attempt++) {
      const trial = build(difficulty, rng)
      if (trial) return trial
    }
  }
  return buildNetz(difficulty, rng)!
}
