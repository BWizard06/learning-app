import type { Rng } from '~~/shared/rng'
import type { JsonObject, Trial, TrialBlock } from '~~/shared/types'

export const BLOCK_ITEM_TYPE = 'figurensatz'
export const ZIEL = 'ziel'
export const ABLENKER = 'ablenker'
export const ITEM_TYPES = [ZIEL, ABLENKER] as const

export type ItemType = (typeof ITEM_TYPES)[number]

export interface DetailSpec {
  arme: number
  drehung: number
  knoten: number
  bogen: number
  fuellung: number
}

export interface FigureSpec {
  kontur: number
  mitte: number
  ort: number
  fueller: number[]
  detail: DetailSpec
}

export type AblenkArt = 'plus' | 'minus' | 'mal'

export interface AblenkAufgabe {
  art: AblenkArt
  a: number
  b: number
  text: string
  loesung: number
  optionen: number[]
  richtig: number
}

export interface SchnittPayload {
  nummer: number
  gesamt: number
  schnitt: DetailSpec
}

export interface SatzPayload extends SchnittPayload {
  figuren: FigureSpec[]
  ablenkung: AblenkAufgabe[]
  lernzeitMs: number
  ablenkzeitMs: number
}

export type SchnittTrial = Trial<SchnittPayload, boolean>

export interface FigurenBlock extends TrialBlock<SchnittPayload, boolean> {
  payload: SatzPayload
  trials: SchnittTrial[]
}

export const DIFFICULTY_MIN = 1
export const DIFFICULTY_MAX = 5

export const FIGUREN_COUNTS: readonly number[] = [3, 4, 5, 6, 8]
export const LERNZEIT_MS: readonly number[] = [15000, 18000, 20000, 22500, 25000]
export const MAX_ABSTAND: readonly number[] = [3, 3, 2, 2, 1]
export const ABLENKZEIT_MS = 20000
export const ABLENK_AUFGABEN = 12

export const ARM_SETS: readonly (readonly number[])[] = [
  [0, 100],
  [0, 140, 250],
  [30, 90, 200],
  [0, 70, 160, 250],
]

export const DREHUNGEN: readonly number[] = [0, 45, 90, 135]
export const KNOTEN_ARTEN = 3
export const BOGEN_ARTEN = 2
export const FUELLUNG_ARTEN = 2

export const KONTUREN: readonly (readonly number[])[] = [
  [56, 50, 56, 50, 56, 50, 56, 50],
  [58, 48, 48, 58, 58, 48, 48, 58],
  [50, 60, 50, 50, 60, 50, 50, 60],
  [54, 54, 48, 60, 54, 54, 48, 60],
]

export const MITTEN_ARTEN = 4
export const FUELLER_ARTEN = 5

export const ORT_WINKEL: readonly number[] = [45, 135, 225, 315]

export const FELD = 120
export const MITTE = FELD / 2
export const ORT_RADIUS = 26
export const REGION_RADIUS = 15
export const DETAIL_RADIUS = 13
export const SCHNITT_RADIUS = 40
export const SCHNITT_RING = 46

function level(difficulty: number): number {
  const rounded = Math.round(difficulty)
  const clamped = Math.min(FIGUREN_COUNTS.length, Math.max(1, rounded))
  return clamped - 1
}

export function clampDifficulty(difficulty: number): number {
  return Math.min(DIFFICULTY_MAX, Math.max(DIFFICULTY_MIN, difficulty))
}

export function figurenCountFor(difficulty: number): number {
  return FIGUREN_COUNTS[level(difficulty)]!
}

export const AUFSTIEG_AB = 0.85
export const ABSTIEG_AB = 0.55

export function naechsteStufe(difficulty: number, rate: number): number {
  const stufe = Math.round(clampDifficulty(difficulty))
  if (rate >= AUFSTIEG_AB) return Math.min(DIFFICULTY_MAX, stufe + 1)
  if (rate <= ABSTIEG_AB) return Math.max(DIFFICULTY_MIN, stufe - 1)
  return stufe
}

export function lernzeitMsFor(difficulty: number): number {
  return LERNZEIT_MS[level(difficulty)]!
}

export function maxAbstandFor(difficulty: number): number {
  return MAX_ABSTAND[level(difficulty)]!
}

function buildPool(): DetailSpec[] {
  const out: DetailSpec[] = []
  for (let arme = 0; arme < ARM_SETS.length; arme++) {
    for (let drehung = 0; drehung < DREHUNGEN.length; drehung++) {
      for (let knoten = 0; knoten < KNOTEN_ARTEN; knoten++) {
        for (let bogen = 0; bogen < BOGEN_ARTEN; bogen++) {
          for (let fuellung = 0; fuellung < FUELLUNG_ARTEN; fuellung++) {
            out.push({ arme, drehung, knoten, bogen, fuellung })
          }
        }
      }
    }
  }
  return out
}

export const DETAIL_POOL: readonly DetailSpec[] = buildPool()

export function detailKey(detail: DetailSpec): string {
  return `${detail.arme}-${detail.drehung}-${detail.knoten}-${detail.bogen}-${detail.fuellung}`
}

export function detailDistance(a: DetailSpec, b: DetailSpec): number {
  let count = 0
  if (a.arme !== b.arme) count++
  if (a.drehung !== b.drehung) count++
  if (a.knoten !== b.knoten) count++
  if (a.bogen !== b.bogen) count++
  if (a.fuellung !== b.fuellung) count++
  return count
}

export function minAbstand(detail: DetailSpec, gelernt: readonly DetailSpec[]): number {
  let best = 5
  for (const other of gelernt) {
    const abstand = detailDistance(detail, other)
    if (abstand < best) best = abstand
  }
  return best
}

function fmt(value: number): string {
  return String(Math.round(value * 100) / 100)
}

function punkt(cx: number, cy: number, radius: number, winkel: number): [number, number] {
  const bogenmass = (winkel * Math.PI) / 180
  return [cx + Math.cos(bogenmass) * radius, cy - Math.sin(bogenmass) * radius]
}

function line(x1: number, y1: number, x2: number, y2: number): string {
  return `<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}"/>`
}

function detailMarkup(detail: DetailSpec, cx: number, cy: number, radius: number): string {
  const arme = ARM_SETS[detail.arme]!
  const innen = radius * 0.3
  const aussen = radius * 0.92
  const parts: string[] = []

  for (const winkel of arme) {
    const [x1, y1] = punkt(0, 0, innen, winkel)
    const [x2, y2] = punkt(0, 0, aussen, winkel)
    parts.push(line(x1, y1, x2, y2))
    if (detail.knoten === 1) {
      parts.push(`<circle cx="${fmt(x2)}" cy="${fmt(y2)}" r="${fmt(radius * 0.13)}" fill="currentColor"/>`)
    } else if (detail.knoten === 2) {
      const [bx1, by1] = punkt(x2, y2, radius * 0.19, winkel + 90)
      const [bx2, by2] = punkt(x2, y2, radius * 0.19, winkel - 90)
      parts.push(line(bx1, by1, bx2, by2))
    }
  }

  if (detail.bogen === 1) {
    const bogenRadius = radius * 0.62
    const [x1, y1] = punkt(0, 0, bogenRadius, arme[0]!)
    const [x2, y2] = punkt(0, 0, bogenRadius, arme[1]!)
    const spanne = (((arme[1]! - arme[0]!) % 360) + 360) % 360
    const gross = spanne > 180 ? 1 : 0
    parts.push(
      `<path d="M ${fmt(x1)} ${fmt(y1)} A ${fmt(bogenRadius)} ${fmt(bogenRadius)} 0 ${gross} 0 ${fmt(x2)} ${fmt(y2)}"/>`,
    )
  }

  const kern = fmt(radius * 0.2)
  parts.push(
    detail.fuellung === 1
      ? `<circle cx="0" cy="0" r="${kern}" fill="currentColor"/>`
      : `<circle cx="0" cy="0" r="${kern}"/>`,
  )

  const strich = radius >= 30 ? 3 : 1.7
  const dreh = -DREHUNGEN[detail.drehung]!
  return `<g transform="translate(${fmt(cx)} ${fmt(cy)}) rotate(${fmt(dreh)})" stroke-width="${fmt(strich)}">${parts.join('')}</g>`
}

function konturMarkup(kontur: number): string {
  const radien = KONTUREN[kontur]!
  const punkte: string[] = []
  for (let i = 0; i < radien.length; i++) {
    const [x, y] = punkt(MITTE, MITTE, radien[i]!, (360 / radien.length) * i)
    punkte.push(`${fmt(x)},${fmt(y)}`)
  }
  return `<polygon points="${punkte.join(' ')}"/>`
}

function mitteMarkup(mitte: number): string {
  if (mitte === 1) return `<circle cx="${MITTE}" cy="${MITTE}" r="7"/>`
  if (mitte === 2) return `<rect x="${MITTE - 7}" y="${MITTE - 7}" width="14" height="14"/>`
  if (mitte === 3) return `<circle cx="${MITTE}" cy="${MITTE}" r="4.5" fill="currentColor"/>`
  return ''
}

function fuellerMarkup(art: number, x: number, y: number): string {
  if (art === 1) return `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="5" fill="currentColor"/>`
  if (art === 2) return line(x - 8, y, x + 8, y)
  if (art === 3) {
    const punkte = [punkt(x, y, 8, 90), punkt(x, y, 8, 210), punkt(x, y, 8, 330)]
    return `<polygon points="${punkte.map(([px, py]) => `${fmt(px)},${fmt(py)}`).join(' ')}"/>`
  }
  if (art === 4) return `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="8"/>`
  return ''
}

function svgHuelle(inhalt: string): string {
  return [
    `<svg viewBox="0 0 ${FELD} ${FELD}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"`,
    ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
    inhalt,
    '</svg>',
  ].join('')
}

export function figureToSvg(figure: FigureSpec): string {
  const parts: string[] = [konturMarkup(figure.kontur), mitteMarkup(figure.mitte)]

  for (let index = 0; index < ORT_WINKEL.length; index++) {
    if (index === figure.ort) continue
    const art = figure.fueller[index] ?? 0
    if (art === 0) continue
    const winkel = ORT_WINKEL[index]!
    const [sx1, sy1] = punkt(MITTE, MITTE, 13, winkel)
    const [sx2, sy2] = punkt(MITTE, MITTE, 18, winkel)
    const [fx, fy] = punkt(MITTE, MITTE, ORT_RADIUS, winkel)
    parts.push(line(sx1, sy1, sx2, sy2))
    parts.push(fuellerMarkup(art, fx, fy))
  }

  const [ox, oy] = punkt(MITTE, MITTE, ORT_RADIUS, ORT_WINKEL[figure.ort]!)
  parts.push(
    `<circle cx="${fmt(ox)}" cy="${fmt(oy)}" r="${REGION_RADIUS}" stroke-width="1.3" stroke-dasharray="3.5 3.5"/>`,
  )
  parts.push(detailMarkup(figure.detail, ox, oy, DETAIL_RADIUS))

  return svgHuelle(parts.join(''))
}

export function schnittToSvg(detail: DetailSpec): string {
  const ring = `<circle cx="${MITTE}" cy="${MITTE}" r="${SCHNITT_RING}" stroke-width="1.4" stroke-dasharray="5 5"/>`
  return svgHuelle(ring + detailMarkup(detail, MITTE, MITTE, SCHNITT_RADIUS))
}

function buildFigure(detail: DetailSpec, rng: Rng): FigureSpec {
  const ort = rng.int(0, ORT_WINKEL.length - 1)
  const fueller: number[] = []
  for (let index = 0; index < ORT_WINKEL.length; index++) {
    fueller.push(index === ort ? 0 : rng.int(0, FUELLER_ARTEN - 1))
  }
  return {
    kontur: rng.int(0, KONTUREN.length - 1),
    mitte: rng.int(0, MITTEN_ARTEN - 1),
    ort,
    fueller,
    detail,
  }
}

function ablenkerPool(gelernt: readonly DetailSpec[], budget: number): DetailSpec[] {
  const out: DetailSpec[] = []
  for (const kandidat of DETAIL_POOL) {
    const abstand = minAbstand(kandidat, gelernt)
    if (abstand >= 1 && abstand <= budget) out.push(kandidat)
  }
  return out
}

function waehleAblenker(
  gelernt: readonly DetailSpec[],
  budget: number,
  anzahl: number,
  rng: Rng,
): { ablenker: DetailSpec[]; aehnlichkeit: number } {
  let aehnlichkeit = budget
  let pool = ablenkerPool(gelernt, aehnlichkeit)
  while (pool.length < anzahl && aehnlichkeit < 5) {
    aehnlichkeit++
    pool = ablenkerPool(gelernt, aehnlichkeit)
  }
  return { ablenker: rng.sample(pool, anzahl), aehnlichkeit }
}

function fehlerWerte(art: AblenkArt, a: number, b: number, loesung: number): number[] {
  if (art === 'mal') return [loesung + a, loesung - a, loesung + b, loesung - b]
  return [loesung + 10, loesung - 10, loesung + 1, loesung - 1]
}

function zeichenFor(art: AblenkArt): string {
  if (art === 'plus') return '+'
  if (art === 'minus') return '-'
  return '×'
}

function ablenkAufgabe(rng: Rng): AblenkAufgabe {
  const art = rng.weighted<AblenkArt>([
    ['plus', 3],
    ['minus', 3],
    ['mal', 2],
  ])

  let a = 0
  let b = 0
  let loesung = 0

  if (art === 'plus') {
    a = rng.int(12, 89)
    b = rng.int(4, 29)
    loesung = a + b
  } else if (art === 'minus') {
    a = rng.int(41, 98)
    b = rng.int(4, 29)
    loesung = a - b
  } else {
    a = rng.int(3, 9)
    b = rng.int(4, 9)
    loesung = a * b
  }

  const kandidaten: number[] = []
  for (const wert of fehlerWerte(art, a, b, loesung)) {
    if (wert <= 0 || wert === loesung || kandidaten.includes(wert)) continue
    kandidaten.push(wert)
  }

  const optionen = rng.shuffle([loesung, ...rng.sample(kandidaten, 2)])
  return {
    art,
    a,
    b,
    text: `${a} ${zeichenFor(art)} ${b}`,
    loesung,
    optionen,
    richtig: optionen.indexOf(loesung),
  }
}

function detailToJson(detail: DetailSpec): JsonObject {
  return {
    arme: detail.arme,
    drehung: detail.drehung,
    knoten: detail.knoten,
    bogen: detail.bogen,
    fuellung: detail.fuellung,
  }
}

function figureToJson(figure: FigureSpec): JsonObject {
  return {
    kontur: figure.kontur,
    mitte: figure.mitte,
    ort: figure.ort,
    fueller: [...figure.fueller],
    detail: detailToJson(figure.detail),
  }
}

function aufgabeToJson(aufgabe: AblenkAufgabe): JsonObject {
  return { art: aufgabe.art, a: aufgabe.a, b: aufgabe.b }
}

export function generateFigurenBlock(difficulty: number, rng: Rng): FigurenBlock {
  const anzahl = figurenCountFor(difficulty)
  const lernzeitMs = lernzeitMsFor(difficulty)
  const gelernt = rng.sample(DETAIL_POOL, anzahl)
  const figuren = gelernt.map((detail) => buildFigure(detail, rng))

  const { ablenker, aehnlichkeit } = waehleAblenker(gelernt, maxAbstandFor(difficulty), anzahl, rng)

  const gemischt = rng.shuffle([
    ...gelernt.map((detail) => ({ detail, ziel: true })),
    ...ablenker.map((detail) => ({ detail, ziel: false })),
  ])

  const ablenkung: AblenkAufgabe[] = []
  for (let i = 0; i < ABLENK_AUFGABEN; i++) ablenkung.push(ablenkAufgabe(rng))

  const trials: SchnittTrial[] = gemischt.map((eintrag, index) => ({
    itemType: eintrag.ziel ? ZIEL : ABLENKER,
    difficulty,
    params: {
      type: eintrag.ziel ? ZIEL : ABLENKER,
      ziel: eintrag.ziel,
      position: index,
      detail: detailToJson(eintrag.detail),
      abstand: minAbstand(eintrag.detail, gelernt),
      aehnlichkeit,
      lernzeitMs,
      anzahlFiguren: anzahl,
    },
    payload: { nummer: index + 1, gesamt: gemischt.length, schnitt: eintrag.detail },
    answer: eintrag.ziel,
  }))

  return {
    kind: 'block',
    itemType: BLOCK_ITEM_TYPE,
    difficulty,
    params: {
      type: BLOCK_ITEM_TYPE,
      anzahlFiguren: anzahl,
      ziele: anzahl,
      ablenker: anzahl,
      lernzeitMs,
      ablenkzeitMs: ABLENKZEIT_MS,
      aehnlichkeit,
      figuren: figuren.map(figureToJson),
      ablenkung: ablenkung.map(aufgabeToJson),
    },
    payload: {
      nummer: 1,
      gesamt: gemischt.length,
      schnitt: gemischt[0]!.detail,
      figuren,
      ablenkung,
      lernzeitMs,
      ablenkzeitMs: ABLENKZEIT_MS,
    },
    trials,
  }
}
