import type { Rng } from '~~/shared/rng'
import type { ChoiceOption, JsonObject, Trial } from '~~/shared/types'

export const CHART_KINDS = ['balken', 'linie', 'kreis', 'tabelle'] as const
export const QUESTION_KINDS = ['differenz', 'anteil', 'trend', 'extrem'] as const

export type ChartKind = (typeof CHART_KINDS)[number]
export type QuestionKind = (typeof QUESTION_KINDS)[number]

export type Variante =
  | 'paar'
  | 'summe'
  | 'einzel'
  | 'doppel'
  | 'absolut'
  | 'relativ'
  | 'hoch'
  | 'tief'
  | 'zweithoch'
  | 'zweittief'

export function questionKindsFor(chart: ChartKind): QuestionKind[] {
  return QUESTION_KINDS.filter((kind) => kind !== 'trend' || chart !== 'kreis')
}

export const ITEM_TYPES: readonly string[] = CHART_KINDS.flatMap((chart) =>
  questionKindsFor(chart).map((kind) => `${chart}-${kind}`),
)

export interface TabellenZeile {
  label: string
  wert: number
}

export interface DatenPayload {
  chart: ChartKind
  titel: string
  einheit: string
  spalte: string
  frage: string
  svg: string
  zeilen: TabellenZeile[]
  suffix: string
}

export type DatenTrial = Trial<DatenPayload, number>

interface Quelle {
  titel: string
  einheit: string
  spalte: string
  pool: readonly string[]
  fenster: boolean
}

export interface Datensatz {
  labels: string[]
  prozente: number[]
  werte: number[]
  gesamt: number
  einheitsfaktor: number
  titel: string
  einheit: string
  spalte: string
  zeitlich: boolean
}

const NOMINALE_QUELLEN: readonly Quelle[] = [
  {
    titel: 'Besucher nach Filiale',
    einheit: 'Personen',
    spalte: 'Filiale',
    pool: ['Nord', 'Süd', 'Ost', 'West', 'Mitte', 'Bahnhof'],
    fenster: false,
  },
  {
    titel: 'Umsatz nach Abteilung',
    einheit: 'Fr.',
    spalte: 'Abteilung',
    pool: ['Einkauf', 'Verkauf', 'Technik', 'Lager', 'Büro', 'Kasse'],
    fenster: false,
  },
  {
    titel: 'Mitglieder nach Sportart',
    einheit: 'Personen',
    spalte: 'Sportart',
    pool: ['Ski', 'Tennis', 'Golf', 'Judo', 'Turnen', 'Hockey'],
    fenster: false,
  },
  {
    titel: 'Verkäufe nach Produkt',
    einheit: 'Stück',
    spalte: 'Produkt',
    pool: ['Brot', 'Milch', 'Kaffee', 'Tee', 'Käse', 'Butter'],
    fenster: false,
  },
  {
    titel: 'Anmeldungen nach Kurs',
    einheit: 'Personen',
    spalte: 'Kurs',
    pool: ['Malen', 'Kochen', 'Singen', 'Tanzen', 'Nähen', 'Töpfern'],
    fenster: false,
  },
]

const ZEITLICHE_QUELLEN: readonly Quelle[] = [
  {
    titel: 'Besucher pro Monat',
    einheit: 'Personen',
    spalte: 'Monat',
    pool: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
    fenster: true,
  },
  {
    titel: 'Bestellungen pro Wochentag',
    einheit: 'Stück',
    spalte: 'Tag',
    pool: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
    fenster: true,
  },
  {
    titel: 'Fahrten pro Quartal',
    einheit: 'Fahrten',
    spalte: 'Quartal',
    pool: ['Q1', 'Q2', 'Q3', 'Q4'],
    fenster: true,
  },
  {
    titel: 'Umsatz pro Jahr',
    einheit: 'Fr.',
    spalte: 'Jahr',
    pool: ['2019', '2020', '2021', '2022', '2023', '2024'],
    fenster: true,
  },
]

export const COUNT_RANGE: readonly (readonly [number, number])[] = [
  [3, 4],
  [3, 4],
  [4, 5],
  [4, 5],
  [5, 6],
  [5, 6],
]

const ROUND_P: readonly number[] = [0.95, 0.8, 0.6, 0.45, 0.3, 0.15]
const TWO_STEP_P: readonly number[] = [0.2, 0.32, 0.44, 0.56, 0.68, 0.8]

const ROUND_UNITS: readonly number[] = [2, 5, 10]
const ROUGH_UNITS: readonly number[] = [2, 3, 4, 6, 7, 8, 9]

const MAX_SHARE = 55
const RETRIES = 24

export const FALLBACK_PROZENTE: Record<number, readonly number[]> = {
  3: [22, 30, 48],
  4: [15, 21, 30, 34],
  5: [6, 13, 23, 26, 32],
  6: [4, 12, 15, 21, 22, 26],
}

export const VIEW_W = 320
export const VIEW_H = 190
const PLOT_LEFT = 40
const PLOT_RIGHT = 312
const PLOT_TOP = 40
const PLOT_BASE = 154
const LABEL_Y = 172
const UNIT_Y = 14

export const PIE_CX = 86
export const PIE_CY = 100
export const PIE_R = 60
const LEGEND_X = 162
const LEGEND_ROW = 19

function fmt(value: number): string {
  return String(Math.round(value * 1000) / 1000)
}

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function stufeVon(difficulty: number): number {
  return Math.min(6, Math.max(1, Math.round(difficulty)))
}

function spreadPartition(rng: Rng, n: number, total: number, minFirst: number): number[] {
  const gaps: number[] = []
  for (let i = 0; i < n; i++) gaps.push(i === 0 ? minFirst : 1)

  let rest = total
  for (let i = 0; i < n; i++) rest -= (n - i) * gaps[i]!

  while (rest > 0) {
    const eligible: number[] = []
    for (let i = 0; i < n; i++) {
      if (n - i <= rest) eligible.push(i)
    }
    const pick = rng.pick(eligible)
    gaps[pick] = gaps[pick]! + 1
    rest -= n - pick
  }

  const values: number[] = []
  let running = 0
  for (let i = 0; i < n; i++) {
    running += gaps[i]!
    values.push(running)
  }
  return values
}

export function percentVector(rng: Rng, n: number, rund: boolean): number[] {
  const schritt = rund ? (n <= 5 ? 5 : 2) : 1
  const einheiten = 100 / schritt
  const minFirst = schritt === 1 ? 3 : schritt === 2 ? 2 : 1

  let letzte: number[] = []
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    const kandidat = spreadPartition(rng, n, einheiten, minFirst).map((q) => q * schritt)
    letzte = kandidat
    if (kandidat[kandidat.length - 1]! <= MAX_SHARE) return kandidat
  }
  return letzte
}

function pickQuelle(rng: Rng, n: number, zeitlich: boolean): { quelle: Quelle; labels: string[] } {
  const pool = (zeitlich ? ZEITLICHE_QUELLEN : NOMINALE_QUELLEN).filter(
    (entry) => entry.pool.length >= n,
  )
  const quelle = rng.pick(pool)
  if (!quelle.fenster) return { quelle, labels: rng.sample(quelle.pool, n) }
  const start = rng.int(0, quelle.pool.length - n)
  return { quelle, labels: quelle.pool.slice(start, start + n) }
}

function assemble(
  rng: Rng,
  n: number,
  zeitlich: boolean,
  prozente: number[],
  einheitsfaktor: number,
): Datensatz {
  const { quelle, labels } = pickQuelle(rng, n, zeitlich)
  return {
    labels,
    prozente,
    werte: prozente.map((p) => p * einheitsfaktor),
    gesamt: 100 * einheitsfaktor,
    einheitsfaktor,
    titel: quelle.titel,
    einheit: quelle.einheit,
    spalte: quelle.spalte,
    zeitlich,
  }
}

function buildDataset(rng: Rng, n: number, rund: boolean, zeitlich: boolean): Datensatz {
  const prozente = rng.shuffle(percentVector(rng, n, rund))
  const faktor = rng.pick(rund ? ROUND_UNITS : ROUGH_UNITS)
  return assemble(rng, n, zeitlich, prozente, faktor)
}

function fixedDataset(rng: Rng, n: number, rund: boolean, zeitlich: boolean): Datensatz {
  const prozente = [...(FALLBACK_PROZENTE[n] ?? FALLBACK_PROZENTE[4]!)]
  const faktor = rng.pick(rund ? ROUND_UNITS : ROUGH_UNITS)
  return assemble(rng, n, zeitlich, prozente, faktor)
}

export function trendGewinner(werte: readonly number[], variante: Variante): number {
  let best = 0
  let bestIndex = -1
  let treffer = 0
  for (let i = 0; i + 1 < werte.length; i++) {
    const zuwachs = werte[i + 1]! - werte[i]!
    const wert = variante === 'relativ' ? zuwachs / werte[i]! : zuwachs
    if (wert > best) {
      best = wert
      bestIndex = i
      treffer = 1
    } else if (wert === best && bestIndex >= 0) {
      treffer++
    }
  }
  return treffer === 1 ? bestIndex : -1
}

function varianteFor(kind: QuestionKind, zweiSchritte: boolean, rng: Rng): Variante {
  if (kind === 'differenz') return zweiSchritte ? 'summe' : 'paar'
  if (kind === 'anteil') return zweiSchritte ? 'doppel' : 'einzel'
  if (kind === 'trend') return zweiSchritte ? 'relativ' : 'absolut'
  const hoch = rng.bool()
  if (zweiSchritte) return hoch ? 'zweithoch' : 'zweittief'
  return hoch ? 'hoch' : 'tief'
}

interface Aufgabe {
  frage: string
  answer: number
  ziele: number[]
  optionen: string[]
  options?: ChoiceOption[]
  correctIndex?: number
  suffix: string
}

function indices(n: number): number[] {
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push(i)
  return out
}

function differenzAufgabe(daten: Datensatz, variante: Variante, rng: Rng): Aufgabe {
  const alle = indices(daten.labels.length)
  if (variante === 'paar') {
    const [a, b] = rng.sample(alle, 2) as [number, number]
    return {
      frage: `Wie gross ist der Unterschied zwischen ${daten.labels[a]} und ${daten.labels[b]}?`,
      answer: Math.abs(daten.werte[a]! - daten.werte[b]!),
      ziele: [a, b],
      optionen: [],
      suffix: daten.einheit,
    }
  }
  const drei = rng.sample(alle, 3) as [number, number, number]
  const klein = drei.reduce((low, index) => (daten.werte[index]! < daten.werte[low]! ? index : low), drei[0])
  const rest = drei.filter((index) => index !== klein) as [number, number]
  return {
    frage: `Wie viel mehr ergeben ${daten.labels[rest[0]]} und ${daten.labels[rest[1]]} zusammen als ${daten.labels[klein]}?`,
    answer: daten.werte[rest[0]]! + daten.werte[rest[1]]! - daten.werte[klein]!,
    ziele: [klein, rest[0], rest[1]],
    optionen: [],
    suffix: daten.einheit,
  }
}

function anteilAufgabe(daten: Datensatz, variante: Variante, rng: Rng): Aufgabe {
  const alle = indices(daten.labels.length)
  if (variante === 'einzel') {
    const [a] = rng.sample(alle, 1) as [number]
    return {
      frage: `Wie viel Prozent des Totals entfallen auf ${daten.labels[a]}?`,
      answer: daten.prozente[a]!,
      ziele: [a],
      optionen: [],
      suffix: '%',
    }
  }
  const [a, b] = rng.sample(alle, 2) as [number, number]
  return {
    frage: `Wie viel Prozent des Totals entfallen auf ${daten.labels[a]} und ${daten.labels[b]} zusammen?`,
    answer: daten.prozente[a]! + daten.prozente[b]!,
    ziele: [a, b],
    optionen: [],
    suffix: '%',
  }
}

function trendAufgabe(daten: Datensatz, variante: Variante): Aufgabe {
  const gewinner = trendGewinner(daten.werte, variante)
  const sicher = gewinner >= 0 ? gewinner : 0
  const optionen: string[] = []
  for (let i = 0; i + 1 < daten.labels.length; i++) {
    optionen.push(`${daten.labels[i]} auf ${daten.labels[i + 1]}`)
  }
  return {
    frage:
      variante === 'relativ'
        ? 'Wo ist der Anstieg prozentual am grössten?'
        : 'Wo ist der Anstieg am grössten?',
    answer: sicher,
    ziele: [sicher],
    optionen,
    options: optionen.map((label, index) => ({ id: `schritt-${index}`, label })),
    correctIndex: sicher,
    suffix: '',
  }
}

function extremAufgabe(daten: Datensatz, variante: Variante): Aufgabe {
  const sortiert = daten.werte.map((wert, index) => ({ wert, index })).sort((a, b) => a.wert - b.wert)
  const n = sortiert.length
  const ziel =
    variante === 'hoch'
      ? sortiert[n - 1]!.index
      : variante === 'zweithoch'
        ? sortiert[n - 2]!.index
        : variante === 'tief'
          ? sortiert[0]!.index
          : sortiert[1]!.index
  const frage =
    variante === 'hoch'
      ? 'Wo ist der Wert am höchsten?'
      : variante === 'zweithoch'
        ? 'Wo ist der Wert am zweithöchsten?'
        : variante === 'tief'
          ? 'Wo ist der Wert am tiefsten?'
          : 'Wo ist der Wert am zweittiefsten?'
  return {
    frage,
    answer: ziel,
    ziele: [ziel],
    optionen: [...daten.labels],
    options: daten.labels.map((label, index) => ({ id: `feld-${index}`, label })),
    correctIndex: ziel,
    suffix: '',
  }
}

function aufgabeFor(kind: QuestionKind, variante: Variante, daten: Datensatz, rng: Rng): Aufgabe {
  if (kind === 'differenz') return differenzAufgabe(daten, variante, rng)
  if (kind === 'anteil') return anteilAufgabe(daten, variante, rng)
  if (kind === 'trend') return trendAufgabe(daten, variante)
  return extremAufgabe(daten, variante)
}

const NICE_STEPS: readonly number[] = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 10]

export function axisMaxFor(max: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(1, max)))
  for (const step of NICE_STEPS) {
    const kandidat = Math.round(step * magnitude)
    if (kandidat >= max && kandidat % 2 === 0) return kandidat
  }
  return Math.ceil(max / 20) * 20
}

function svgTitel(daten: Datensatz): string {
  const paare = daten.labels.map((label, index) => `${label} ${daten.werte[index]}`)
  return `${daten.titel}, Angaben in ${daten.einheit}. ${paare.join(', ')}`
}

function rahmen(inhalt: string, daten: Datensatz): string {
  return [
    `<svg viewBox="0 0 ${VIEW_W} ${VIEW_H}" xmlns="http://www.w3.org/2000/svg" role="img">`,
    `<title>${esc(svgTitel(daten))}</title>`,
    `<text class="einheit" x="4" y="${UNIT_Y}" font-size="9.5" fill="currentColor" fill-opacity="0.7">${esc(daten.einheit)}</text>`,
    inhalt,
    '</svg>',
  ].join('')
}

function achsen(axisMax: number): string {
  const mitte = (PLOT_TOP + PLOT_BASE) / 2
  const zeilen: readonly (readonly [number, number])[] = [
    [axisMax, PLOT_TOP],
    [axisMax / 2, mitte],
    [0, PLOT_BASE],
  ]
  const linien = zeilen
    .map(
      ([wert, y]) =>
        `<line x1="${PLOT_LEFT}" y1="${y}" x2="${PLOT_RIGHT}" y2="${y}" stroke="currentColor" stroke-opacity="${wert === 0 ? '0.75' : '0.16'}" stroke-width="1"/>` +
        `<text class="tick" x="${PLOT_LEFT - 6}" y="${y + 3.4}" text-anchor="end" font-size="9" fill="currentColor" fill-opacity="0.7">${Math.round(wert)}</text>`,
    )
    .join('')
  return `${linien}<line x1="${PLOT_LEFT}" y1="${PLOT_TOP}" x2="${PLOT_LEFT}" y2="${PLOT_BASE}" stroke="currentColor" stroke-opacity="0.75" stroke-width="1"/>`
}

function marken(daten: Datensatz, slot: number): string {
  return daten.labels
    .map(
      (label, index) =>
        `<text class="marke" x="${fmt(PLOT_LEFT + slot * (index + 0.5))}" y="${LABEL_Y}" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">${esc(label)}</text>`,
    )
    .join('')
}

function balkenSvg(daten: Datensatz): string {
  const axisMax = axisMaxFor(Math.max(...daten.werte))
  const n = daten.werte.length
  const slot = (PLOT_RIGHT - PLOT_LEFT) / n
  const breite = Math.min(34, slot * 0.56)
  const hoehe = PLOT_BASE - PLOT_TOP

  const balken = daten.werte
    .map((wert, index) => {
      const h = (wert / axisMax) * hoehe
      const cx = PLOT_LEFT + slot * (index + 0.5)
      return (
        `<rect x="${fmt(cx - breite / 2)}" y="${fmt(PLOT_BASE - h)}" width="${fmt(breite)}" height="${fmt(h)}" rx="2" fill="currentColor" fill-opacity="0.68"/>` +
        `<text class="wert" x="${fmt(cx)}" y="${fmt(PLOT_BASE - h - 5)}" text-anchor="middle" font-size="9.5" fill="currentColor">${wert}</text>`
      )
    })
    .join('')

  return rahmen(`${achsen(axisMax)}${balken}${marken(daten, slot)}`, daten)
}

function linieSvg(daten: Datensatz): string {
  const axisMax = axisMaxFor(Math.max(...daten.werte))
  const n = daten.werte.length
  const slot = (PLOT_RIGHT - PLOT_LEFT) / n
  const hoehe = PLOT_BASE - PLOT_TOP

  const punkte = daten.werte.map((wert, index) => ({
    x: PLOT_LEFT + slot * (index + 0.5),
    y: PLOT_BASE - (wert / axisMax) * hoehe,
    wert,
  }))

  const pfad = punkte.map((punkt) => `${fmt(punkt.x)},${fmt(punkt.y)}`).join(' ')
  const kreise = punkte
    .map(
      (punkt) =>
        `<circle cx="${fmt(punkt.x)}" cy="${fmt(punkt.y)}" r="3.2" fill="currentColor"/>` +
        `<text class="wert" x="${fmt(punkt.x)}" y="${fmt(punkt.y - 8)}" text-anchor="middle" font-size="9.5" fill="currentColor">${punkt.wert}</text>`,
    )
    .join('')

  const linie = `<polyline points="${pfad}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`
  return rahmen(`${achsen(axisMax)}${linie}${kreise}${marken(daten, slot)}`, daten)
}

export interface PieSegment {
  index: number
  prozent: number
  startDeg: number
  endDeg: number
  sweepDeg: number
  largeArc: 0 | 1
  x0: number
  y0: number
  x1: number
  y1: number
  path: string
}

function punktAuf(winkelGrad: number): { x: number; y: number } {
  const rad = (winkelGrad * Math.PI) / 180
  return { x: PIE_CX + PIE_R * Math.cos(rad), y: PIE_CY + PIE_R * Math.sin(rad) }
}

export function pieSegments(prozente: readonly number[]): PieSegment[] {
  const out: PieSegment[] = []
  let cursor = -90
  for (let index = 0; index < prozente.length; index++) {
    const prozent = prozente[index]!
    const sweepDeg = (prozent / 100) * 360
    const startDeg = cursor
    const endDeg = cursor + sweepDeg
    const start = punktAuf(startDeg)
    const end = punktAuf(endDeg)
    const largeArc: 0 | 1 = sweepDeg > 180 ? 1 : 0
    out.push({
      index,
      prozent,
      startDeg,
      endDeg,
      sweepDeg,
      largeArc,
      x0: start.x,
      y0: start.y,
      x1: end.x,
      y1: end.y,
      path: `M ${PIE_CX} ${PIE_CY} L ${fmt(start.x)} ${fmt(start.y)} A ${PIE_R} ${PIE_R} 0 ${largeArc} 1 ${fmt(end.x)} ${fmt(end.y)} Z`,
    })
    cursor = endDeg
  }
  return out
}

export function segmentFarbe(index: number): string {
  return index % 2 === 1 ? 'var(--accent)' : 'currentColor'
}

export function segmentDeckung(index: number): number {
  return Math.round((0.88 - Math.floor(index / 2) * 0.3) * 100) / 100
}

function kreisSvg(daten: Datensatz): string {
  const segmente = pieSegments(daten.prozente)
  const stuecke = segmente
    .map(
      (segment) =>
        `<path d="${segment.path}" fill="${segmentFarbe(segment.index)}" fill-opacity="${segmentDeckung(segment.index)}" stroke="var(--raised)" stroke-width="1.5" stroke-linejoin="round"/>`,
    )
    .join('')

  const n = daten.labels.length
  const startY = PIE_CY - (n * LEGEND_ROW) / 2 + 13
  const legende = daten.labels
    .map((label, index) => {
      const y = startY + index * LEGEND_ROW
      return (
        `<rect x="${LEGEND_X}" y="${fmt(y - 9)}" width="11" height="11" rx="2" fill="${segmentFarbe(index)}" fill-opacity="${segmentDeckung(index)}" stroke="currentColor" stroke-opacity="0.45"/>` +
        `<text class="legende" x="${LEGEND_X + 18}" y="${fmt(y)}" font-size="10.5" fill="currentColor">${esc(label)} <tspan class="wert">${daten.werte[index]}</tspan></text>`
      )
    })
    .join('')

  return rahmen(`${stuecke}${legende}`, daten)
}

function diagrammSvg(chart: ChartKind, daten: Datensatz): string {
  if (chart === 'balken') return balkenSvg(daten)
  if (chart === 'linie') return linieSvg(daten)
  return kreisSvg(daten)
}

function paramsFor(
  itemType: string,
  chart: ChartKind,
  kind: QuestionKind,
  variante: Variante,
  rund: boolean,
  daten: Datensatz,
  aufgabe: Aufgabe,
): JsonObject {
  return {
    type: itemType,
    chart,
    kind,
    variante,
    rund,
    zeitlich: daten.zeitlich,
    kategorien: daten.labels.length,
    labels: [...daten.labels],
    prozente: [...daten.prozente],
    werte: [...daten.werte],
    gesamt: daten.gesamt,
    einheitsfaktor: daten.einheitsfaktor,
    einheit: daten.einheit,
    titel: daten.titel,
    spalte: daten.spalte,
    ziele: [...aufgabe.ziele],
    optionen: [...aufgabe.optionen],
  }
}

export function generateDatenlesen(difficulty: number, rng: Rng): DatenTrial {
  const stufe = stufeVon(difficulty)
  const chart = rng.pick(CHART_KINDS)
  const kind = rng.pick(questionKindsFor(chart))
  const spanne = COUNT_RANGE[stufe - 1]!
  const n = rng.int(spanne[0], spanne[1])
  const rund = rng.bool(ROUND_P[stufe - 1]!)
  const zweiSchritte = rng.bool(TWO_STEP_P[stufe - 1]!)
  const zeitlich =
    chart === 'kreis' ? false : chart === 'linie' || kind === 'trend' ? true : rng.bool(0.5)
  const variante = varianteFor(kind, zweiSchritte, rng)

  let daten = buildDataset(rng, n, rund, zeitlich)
  if (kind === 'trend') {
    let attempt = 0
    while (trendGewinner(daten.werte, variante) < 0 && attempt < RETRIES) {
      daten = buildDataset(rng, n, rund, zeitlich)
      attempt++
    }
    if (trendGewinner(daten.werte, variante) < 0) daten = fixedDataset(rng, n, rund, zeitlich)
  }

  const schritt = rund ? (n <= 5 ? 5 : 2) : 1
  const rundEffektiv = rund && daten.prozente.every((prozent) => prozent % schritt === 0)

  const aufgabe = aufgabeFor(kind, variante, daten, rng)
  const itemType = `${chart}-${kind}`

  const payload: DatenPayload = {
    chart,
    titel: daten.titel,
    einheit: daten.einheit,
    spalte: daten.spalte,
    frage: aufgabe.frage,
    svg: chart === 'tabelle' ? '' : diagrammSvg(chart, daten),
    zeilen:
      chart === 'tabelle'
        ? daten.labels.map((label, index) => ({ label, wert: daten.werte[index]! }))
        : [],
    suffix: aufgabe.suffix,
  }

  const trial: DatenTrial = {
    itemType,
    difficulty,
    params: paramsFor(itemType, chart, kind, variante, rundEffektiv, daten, aufgabe),
    payload,
    answer: aufgabe.answer,
  }

  if (aufgabe.options) {
    trial.options = aufgabe.options
    trial.correctIndex = aufgabe.correctIndex
  }

  return trial
}
