import { describe, expect, it } from 'vitest'
import { createRng } from '~~/shared/rng'
import { runGeneratorContract } from '~~/shared/testing/generator-contract'
import { propertyRuns } from '~~/shared/testing/property'
import definition from './definition'
import {
  CHART_KINDS,
  COUNT_RANGE,
  FALLBACK_PROZENTE,
  ITEM_TYPES,
  PIE_CX,
  PIE_CY,
  PIE_R,
  QUESTION_KINDS,
  axisMaxFor,
  generateDatenlesen,
  percentVector,
  pieSegments,
  questionKindsFor,
  segmentDeckung,
  segmentFarbe,
  trendGewinner,
  type DatenPayload,
} from './generator'

interface Gelesen {
  chart: string
  kind: string
  variante: string
  rund: boolean
  zeitlich: boolean
  kategorien: number
  labels: string[]
  prozente: number[]
  werte: number[]
  gesamt: number
  einheitsfaktor: number
  einheit: string
  titel: string
  spalte: string
  ziele: number[]
  optionen: string[]
}

const SCHARF = 'ß'
const GEDANKENSTRICHE = ['–', '—']

function lies(params: unknown): Gelesen {
  return params as unknown as Gelesen
}

function summe(values: readonly number[]): number {
  let total = 0
  for (const value of values) total += value
  return total
}

function aufsteigend(values: readonly number[]): number[] {
  return [...values].sort((a, b) => a - b)
}

function labelTreffer(frage: string, labels: readonly string[]): number[] {
  const hits: number[] = []
  labels.forEach((label, index) => {
    if (frage.includes(label)) hits.push(index)
  })
  return hits
}

function normDeg(deg: number): number {
  return ((deg % 360) + 360) % 360
}

function winkelAbstand(a: number, b: number): number {
  const diff = Math.abs(normDeg(a) - normDeg(b))
  return diff > 180 ? 360 - diff : diff
}

const PFAD = /^M (\S+) (\S+) L (\S+) (\S+) A (\S+) (\S+) 0 ([01]) 1 (\S+) (\S+) Z$/

function pfadTeile(path: string) {
  const treffer = PFAD.exec(path)
  expect(treffer, `Pfad nicht lesbar: ${path}`).not.toBeNull()
  const zahl = (index: number) => Number(treffer![index]!)
  return {
    cx: zahl(1),
    cy: zahl(2),
    x0: zahl(3),
    y0: zahl(4),
    rx: zahl(5),
    ry: zahl(6),
    largeArc: zahl(7),
    x1: zahl(8),
    y1: zahl(9),
  }
}

function textInhalte(svg: string): string[] {
  return [...svg.matchAll(/>([^<>]*)<\/(?:text|tspan)>/g)].map((treffer) => treffer[1]!)
}

describe('datenlesen generator', () => {
  it('satisfies the shared generator contract', () => {
    runGeneratorContract(definition, {
      expectIntegerAnswer: true,
      minItemTypes: ITEM_TYPES.length,
      checkTrial: (trial) => {
        const payload = trial.payload as DatenPayload
        const daten = lies(trial.params)

        expect(trial.itemType).toBe(`${daten.chart}-${daten.kind}`)
        expect(ITEM_TYPES).toContain(trial.itemType)
        expect(payload.frage.length).toBeGreaterThan(0)

        for (const text of [payload.frage, payload.titel, payload.einheit, payload.spalte]) {
          expect(text).not.toContain(SCHARF)
          for (const strich of GEDANKENSTRICHE) expect(text).not.toContain(strich)
        }

        if (payload.chart === 'tabelle') {
          expect(payload.svg).toBe('')
          expect(payload.zeilen.map((zeile) => zeile.label)).toEqual(daten.labels)
          expect(payload.zeilen.map((zeile) => zeile.wert)).toEqual(daten.werte)
        } else {
          expect(payload.zeilen).toEqual([])
          expect(payload.svg.startsWith('<svg')).toBe(true)
          expect(payload.svg.endsWith('</svg>')).toBe(true)
          expect(payload.svg).not.toContain(SCHARF)
        }

        if (daten.kind === 'trend' || daten.kind === 'extrem') {
          expect(trial.options!.map((option) => option.label)).toEqual(daten.optionen)
          expect(trial.answer).toBe(trial.correctIndex)
          expect(payload.suffix).toBe('')
        } else {
          expect(trial.options).toBeUndefined()
          expect(payload.suffix.length).toBeGreaterThan(0)
        }
      },
    })
  })

  it('reaches every chart type, question kind and variant at the lowest difficulty', () => {
    const runs = Math.max(propertyRuns(), 12000)
    const perDifficulty = new Map<number, { charts: Set<string>; kinds: Set<string>; types: Set<string> }>()
    const variantenBeiEins = new Set<string>()
    const rundBeiEins = new Set<boolean>()

    for (let i = 0; i < runs; i++) {
      const difficulty = (i % 6) + 1
      const trial = generateDatenlesen(difficulty, createRng(i * 2654435761 + 7))
      const daten = lies(trial.params)

      const bucket = perDifficulty.get(difficulty) ?? {
        charts: new Set<string>(),
        kinds: new Set<string>(),
        types: new Set<string>(),
      }
      bucket.charts.add(daten.chart)
      bucket.kinds.add(daten.kind)
      bucket.types.add(trial.itemType)
      perDifficulty.set(difficulty, bucket)

      if (difficulty === 1) {
        variantenBeiEins.add(daten.variante)
        rundBeiEins.add(daten.rund)
      }
    }

    for (let difficulty = 1; difficulty <= 6; difficulty++) {
      const bucket = perDifficulty.get(difficulty)!
      expect([...bucket.charts].sort(), `Stufe ${difficulty}`).toEqual([...CHART_KINDS].sort())
      expect([...bucket.kinds].sort(), `Stufe ${difficulty}`).toEqual([...QUESTION_KINDS].sort())
      expect([...bucket.types].sort(), `Stufe ${difficulty}`).toEqual([...ITEM_TYPES].sort())
    }

    expect([...variantenBeiEins].sort()).toEqual([
      'absolut',
      'doppel',
      'einzel',
      'hoch',
      'paar',
      'relativ',
      'summe',
      'tief',
      'zweithoch',
      'zweittief',
    ])
    expect([...rundBeiEins].sort()).toEqual([false, true])
  })

  it('never offers a trend question on a pie chart', () => {
    expect(questionKindsFor('kreis')).toEqual(['differenz', 'anteil', 'extrem'])
    expect(ITEM_TYPES).not.toContain('kreis-trend')
    expect(ITEM_TYPES).toHaveLength(15)

    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const trial = generateDatenlesen((i % 6) + 1, createRng(i * 40503 + 19))
      const daten = lies(trial.params)
      if (daten.chart === 'kreis') expect(daten.kind).not.toBe('trend')
      if (daten.chart === 'linie') expect(daten.zeitlich).toBe(true)
      if (daten.chart === 'kreis') expect(daten.zeitlich).toBe(false)
      if (daten.kind === 'trend') expect(daten.zeitlich).toBe(true)
    }
  })

  it('keeps the data set consistent, whole and free of ties', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const trial = generateDatenlesen((i % 6) + 1, createRng(i * 104729 + 23))
      const daten = lies(trial.params)
      const n = daten.labels.length

      expect(n).toBe(daten.kategorien)
      expect(n).toBeGreaterThanOrEqual(3)
      expect(n).toBeLessThanOrEqual(6)
      expect(daten.prozente).toHaveLength(n)
      expect(daten.werte).toHaveLength(n)
      expect(new Set(daten.labels).size).toBe(n)
      expect(new Set(daten.werte).size).toBe(n)

      expect(summe(daten.prozente)).toBe(100)
      expect(summe(daten.werte)).toBe(daten.gesamt)
      expect(daten.gesamt).toBe(100 * daten.einheitsfaktor)
      expect(daten.einheitsfaktor).toBeGreaterThanOrEqual(2)

      for (let k = 0; k < n; k++) {
        expect(Number.isInteger(daten.prozente[k]!)).toBe(true)
        expect(Number.isInteger(daten.werte[k]!)).toBe(true)
        expect(daten.prozente[k]!).toBeGreaterThan(0)
        expect(daten.werte[k]! * 100).toBe(daten.prozente[k]! * daten.gesamt)
      }
    }
  })

  it('lets every percentage come out whole when read off the raw values', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const trial = generateDatenlesen((i % 6) + 1, createRng(i * 15485863 + 31))
      const daten = lies(trial.params)
      const total = summe(daten.werte)

      for (const wert of daten.werte) {
        const anteil = (wert * 100) / total
        expect(Number.isInteger(anteil), `${wert} von ${total} ergibt ${anteil}`).toBe(true)
      }

      for (let a = 0; a < daten.werte.length; a++) {
        for (let b = a + 1; b < daten.werte.length; b++) {
          const paar = ((daten.werte[a]! + daten.werte[b]!) * 100) / total
          expect(Number.isInteger(paar)).toBe(true)
        }
      }
    }
  })

  it('derives every numeric answer from the question text and the raw values', () => {
    const runs = propertyRuns()
    let differenzPaar = 0
    let differenzSumme = 0
    let anteilEinzel = 0
    let anteilDoppel = 0

    for (let i = 0; i < runs; i++) {
      const trial = generateDatenlesen((i % 6) + 1, createRng(i * 2246822519 + 37))
      const daten = lies(trial.params)
      if (daten.kind !== 'differenz' && daten.kind !== 'anteil') continue

      const payload = trial.payload as DatenPayload
      const treffer = labelTreffer(payload.frage, daten.labels)
      const genannt = aufsteigend(treffer.map((index) => daten.werte[index]!))
      const total = summe(daten.werte)

      expect([...treffer].sort((a, b) => a - b)).toEqual([...daten.ziele].sort((a, b) => a - b))

      if (daten.variante === 'paar') {
        differenzPaar++
        expect(treffer).toHaveLength(2)
        expect(payload.frage).toContain('Unterschied')
        expect(trial.answer).toBe(genannt[1]! - genannt[0]!)
        expect(payload.suffix).toBe(daten.einheit)
      } else if (daten.variante === 'summe') {
        differenzSumme++
        expect(treffer).toHaveLength(3)
        expect(payload.frage).toContain('zusammen')
        expect(trial.answer).toBe(genannt[1]! + genannt[2]! - genannt[0]!)
        expect(payload.suffix).toBe(daten.einheit)
      } else if (daten.variante === 'einzel') {
        anteilEinzel++
        expect(treffer).toHaveLength(1)
        expect(payload.frage).toContain('Prozent')
        expect(trial.answer).toBe((genannt[0]! * 100) / total)
        expect(payload.suffix).toBe('%')
      } else {
        anteilDoppel++
        expect(treffer).toHaveLength(2)
        expect(payload.frage).toContain('zusammen')
        expect(trial.answer).toBe(((genannt[0]! + genannt[1]!) * 100) / total)
        expect(payload.suffix).toBe('%')
      }

      expect(trial.answer as number).toBeGreaterThan(0)
      expect(Number.isInteger(trial.answer)).toBe(true)
    }

    expect(differenzPaar).toBeGreaterThan(0)
    expect(differenzSumme).toBeGreaterThan(0)
    expect(anteilEinzel).toBeGreaterThan(0)
    expect(anteilDoppel).toBeGreaterThan(0)
  })

  it('points the trend question at the single strongest rise', () => {
    const runs = propertyRuns()
    let absolut = 0
    let relativ = 0

    for (let i = 0; i < runs; i++) {
      const trial = generateDatenlesen((i % 6) + 1, createRng(i * 3266489917 + 41))
      const daten = lies(trial.params)
      if (daten.kind !== 'trend') continue

      const payload = trial.payload as DatenPayload
      const relativGefragt = payload.frage.includes('prozentual')
      expect(relativGefragt).toBe(daten.variante === 'relativ')
      if (relativGefragt) relativ++
      else absolut++

      const bewertung: number[] = []
      for (let k = 0; k + 1 < daten.werte.length; k++) {
        const zuwachs = daten.werte[k + 1]! - daten.werte[k]!
        bewertung.push(relativGefragt ? zuwachs / daten.werte[k]! : zuwachs)
      }

      const beste = Math.max(...bewertung)
      const gewinner = bewertung.map((wert, index) => (wert === beste ? index : -1)).filter((index) => index >= 0)

      expect(beste).toBeGreaterThan(0)
      expect(gewinner).toHaveLength(1)
      expect(trial.correctIndex).toBe(gewinner[0])
      expect(trial.options).toHaveLength(daten.werte.length - 1)
      trial.options!.forEach((option, index) => {
        expect(option.label).toBe(`${daten.labels[index]} auf ${daten.labels[index + 1]}`)
      })
    }

    expect(absolut).toBeGreaterThan(0)
    expect(relativ).toBeGreaterThan(0)
  })

  it('points the extreme question at the rank the wording asks for', () => {
    const runs = propertyRuns()
    const gesehen = new Set<string>()

    for (let i = 0; i < runs; i++) {
      const trial = generateDatenlesen((i % 6) + 1, createRng(i * 433494437 + 43))
      const daten = lies(trial.params)
      if (daten.kind !== 'extrem') continue

      const payload = trial.payload as DatenPayload
      const sortiert = aufsteigend(daten.werte)
      const n = sortiert.length

      const ausText = payload.frage.includes('zweithöchsten')
        ? 'zweithoch'
        : payload.frage.includes('zweittiefsten')
          ? 'zweittief'
          : payload.frage.includes('höchsten')
            ? 'hoch'
            : 'tief'
      expect(ausText).toBe(daten.variante)
      gesehen.add(ausText)

      const erwartet =
        ausText === 'hoch'
          ? sortiert[n - 1]!
          : ausText === 'zweithoch'
            ? sortiert[n - 2]!
            : ausText === 'tief'
              ? sortiert[0]!
              : sortiert[1]!

      expect(daten.werte[trial.correctIndex!]).toBe(erwartet)
      expect(trial.options).toHaveLength(n)
      trial.options!.forEach((option, index) => {
        expect(option.label).toBe(daten.labels[index])
      })
    }

    expect([...gesehen].sort()).toEqual(['hoch', 'tief', 'zweithoch', 'zweittief'])
  })

  it('closes every pie into a full turn of 360 degrees', () => {
    const proben: number[][] = [
      [25, 25, 25, 25],
      [10, 20, 30, 40],
      [5, 15, 25, 55],
      [3, 7, 11, 19, 26, 34],
      [22, 30, 48],
      [4, 12, 15, 21, 22, 26],
    ]
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      proben.push(lies(generateDatenlesen((i % 6) + 1, createRng(i * 32452843 + 47)).params).prozente)
    }

    for (const prozente of proben) {
      const segmente = pieSegments(prozente)
      expect(segmente).toHaveLength(prozente.length)
      expect(summe(segmente.map((segment) => segment.sweepDeg))).toBeCloseTo(360, 9)
      expect(segmente[0]!.startDeg).toBe(-90)
      expect(segmente[segmente.length - 1]!.endDeg).toBeCloseTo(270, 9)

      for (let k = 1; k < segmente.length; k++) {
        expect(segmente[k]!.startDeg).toBe(segmente[k - 1]!.endDeg)
      }
    }
  })

  it('draws each pie slice on the arc its share demands', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const daten = lies(generateDatenlesen((i % 6) + 1, createRng(i * 6700417 + 53)).params)
      const segmente = pieSegments(daten.prozente)

      let kumuliert = 0
      for (const segment of segmente) {
        const teile = pfadTeile(segment.path)
        expect(teile.cx).toBe(PIE_CX)
        expect(teile.cy).toBe(PIE_CY)
        expect(teile.rx).toBe(PIE_R)
        expect(teile.ry).toBe(PIE_R)

        const start = normDeg((Math.atan2(teile.y0 - PIE_CY, teile.x0 - PIE_CX) * 180) / Math.PI)
        const ende = normDeg((Math.atan2(teile.y1 - PIE_CY, teile.x1 - PIE_CX) * 180) / Math.PI)
        const radiusStart = Math.hypot(teile.x0 - PIE_CX, teile.y0 - PIE_CY)
        const radiusEnde = Math.hypot(teile.x1 - PIE_CX, teile.y1 - PIE_CY)

        expect(radiusStart).toBeCloseTo(PIE_R, 2)
        expect(radiusEnde).toBeCloseTo(PIE_R, 2)
        expect(winkelAbstand(start, -90 + (kumuliert / 100) * 360)).toBeLessThan(0.01)

        kumuliert += segment.prozent
        expect(winkelAbstand(ende, -90 + (kumuliert / 100) * 360)).toBeLessThan(0.01)
        expect(teile.largeArc).toBe(segment.prozent > 50 ? 1 : 0)
      }
      expect(kumuliert).toBe(100)
    }
  })

  it('prints every category label and every value into the generated svg', () => {
    const runs = propertyRuns()
    const chartsGesehen = new Set<string>()

    for (let i = 0; i < runs; i++) {
      const trial = generateDatenlesen((i % 6) + 1, createRng(i * 1597334677 + 59))
      const daten = lies(trial.params)
      const payload = trial.payload as DatenPayload
      chartsGesehen.add(daten.chart)
      if (daten.chart === 'tabelle') continue

      const inhalte = textInhalte(payload.svg)
      for (const label of daten.labels) {
        expect(payload.svg, `${daten.chart} ohne ${label}`).toContain(label)
      }
      for (const wert of daten.werte) {
        expect(inhalte, `${daten.chart} ohne Wert ${wert}`).toContain(String(wert))
      }
      expect(payload.svg).toContain(daten.einheit)
      expect(payload.svg).toContain('<title>')
      expect(payload.svg).toContain('currentColor')
      expect(payload.svg).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
      expect(payload.svg).not.toMatch(/rgb|hsl/)

      if (daten.chart === 'kreis') {
        expect(payload.svg).toContain('var(--accent)')
        expect(payload.svg).toContain('var(--raised)')
      } else {
        expect(payload.svg).toContain('<line')
        const achse = axisMaxFor(Math.max(...daten.werte))
        expect(inhalte).toContain(String(achse))
        expect(inhalte).toContain(String(achse / 2))
      }
    }

    expect([...chartsGesehen].sort()).toEqual([...CHART_KINDS].sort())
  })

  it('keeps every axis maximum above the data, even and halvable', () => {
    for (let max = 12; max <= 700; max++) {
      const achse = axisMaxFor(max)
      expect(achse).toBeGreaterThanOrEqual(max)
      expect(achse % 2).toBe(0)
      expect(Number.isInteger(achse / 2)).toBe(true)
      expect(achse).toBeLessThanOrEqual(max * 2)
    }
  })

  it('gives every pie slice its own shade and its own colour slot', () => {
    for (let n = 3; n <= 6; n++) {
      const stile = new Set<string>()
      for (let i = 0; i < n; i++) stile.add(`${segmentFarbe(i)}@${segmentDeckung(i)}`)
      expect(stile.size).toBe(n)
    }
  })

  it('spreads whole percentages that always add up to one hundred', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const n = (i % 4) + 3
      const rund = i % 2 === 0
      const werte = percentVector(createRng(i * 2654435769 + 61), n, rund)
      expect(werte).toHaveLength(n)
      expect(summe(werte)).toBe(100)
      expect(new Set(werte).size).toBe(n)
      expect(aufsteigend(werte)).toEqual(werte)
      for (const wert of werte) expect(wert).toBeGreaterThan(0)
    }
  })

  it('keeps round data round and reserves it for the easy levels', () => {
    const runs = propertyRuns()
    let rundBeiEins = 0
    let rundBeiSechs = 0
    let zaehlerEins = 0
    let zaehlerSechs = 0

    for (let i = 0; i < runs; i++) {
      const difficulty = (i % 6) + 1
      const trial = generateDatenlesen(difficulty, createRng(i * 7919 + 67))
      const daten = lies(trial.params)

      if (daten.rund) {
        const schritt = daten.labels.length <= 5 ? 5 : 2
        for (const prozent of daten.prozente) expect(prozent % schritt).toBe(0)
        expect([2, 5, 10]).toContain(daten.einheitsfaktor)
      }

      if (difficulty === 1) {
        zaehlerEins++
        if (daten.rund) rundBeiEins++
      }
      if (difficulty === 6) {
        zaehlerSechs++
        if (daten.rund) rundBeiSechs++
      }
    }

    expect(rundBeiEins / zaehlerEins).toBeGreaterThan(rundBeiSechs / zaehlerSechs)
    expect(rundBeiSechs).toBeGreaterThan(0)
  })

  it('shows more categories as the difficulty rises', () => {
    const runs = propertyRuns()
    const perDifficulty = new Map<number, number[]>()

    for (let i = 0; i < runs; i++) {
      const difficulty = (i % 6) + 1
      const daten = lies(generateDatenlesen(difficulty, createRng(i * 2971215073 + 71)).params)
      const bucket = perDifficulty.get(difficulty) ?? []
      bucket.push(daten.labels.length)
      perDifficulty.set(difficulty, bucket)
    }

    const mittel = (difficulty: number) => {
      const bucket = perDifficulty.get(difficulty)!
      return summe(bucket) / bucket.length
    }

    for (let difficulty = 1; difficulty <= 6; difficulty++) {
      const spanne = COUNT_RANGE[difficulty - 1]!
      const bucket = perDifficulty.get(difficulty)!
      expect(Math.min(...bucket)).toBe(spanne[0])
      expect(Math.max(...bucket)).toBe(spanne[1])
    }
    expect(mittel(6)).toBeGreaterThan(mittel(1))
    expect(mittel(4)).toBeGreaterThan(mittel(2))
  })

  it('keeps the fallback data usable for both trend readings', () => {
    for (const n of [3, 4, 5, 6]) {
      const prozente = FALLBACK_PROZENTE[n]!
      expect(prozente).toHaveLength(n)
      expect(summe(prozente)).toBe(100)
      expect(new Set(prozente).size).toBe(n)
      expect(Math.max(...prozente)).toBeLessThanOrEqual(55)
      expect(trendGewinner(prozente, 'absolut')).toBeGreaterThanOrEqual(0)
      expect(trendGewinner(prozente, 'relativ')).toBeGreaterThanOrEqual(0)
    }
  })

  it('reports no winner when the strongest rise is shared or absent', () => {
    expect(trendGewinner([10, 20, 30], 'absolut')).toBe(-1)
    expect(trendGewinner([30, 20, 10], 'absolut')).toBe(-1)
    expect(trendGewinner([10, 40, 30], 'absolut')).toBe(0)
    expect(trendGewinner([10, 12, 40], 'absolut')).toBe(1)
    expect(trendGewinner([5, 20, 100, 190], 'absolut')).toBe(2)
    expect(trendGewinner([5, 20, 100, 190], 'relativ')).toBe(1)
  })
})

describe('datenlesen scoring', () => {
  const result = (correct: boolean, difficulty: number, itemType = 'balken-differenz', rtMs = 9000) => ({
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
    expect(definition.weight(6) / definition.weight(1)).toBeCloseTo(2.2, 10)
  })

  it('splits the hits into calculation and reading', () => {
    const score = definition.score(
      [
        result(true, 3, 'balken-differenz'),
        result(true, 3, 'kreis-anteil'),
        result(true, 3, 'linie-trend'),
        result(true, 3, 'tabelle-extrem'),
        result(false, 3, 'tabelle-anteil'),
      ],
      60,
    )
    expect(score.metrics.attempted).toBe(5)
    expect(score.metrics.correct).toBe(4)
    expect(score.metrics.rechenTreffer).toBe(2)
    expect(score.metrics.lesenTreffer).toBe(2)
    expect(score.metrics.tabelleTreffer).toBe(1)
    expect(score.metrics.diagrammTreffer).toBe(3)
  })

  it('reports zero for an empty session without throwing', () => {
    const score = definition.score([], 60)
    expect(score.raw).toBe(0)
    expect(score.accuracy).toBe(0)
    expect(score.metrics.medianRtMs).toBe(0)
    expect(score.metrics.meanDifficulty).toBe(0)
  })
})
