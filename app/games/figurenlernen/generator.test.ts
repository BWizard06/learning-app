import { describe, expect, it } from 'vitest'
import { createRng } from '~~/shared/rng'
import { runGeneratorContract } from '~~/shared/testing/generator-contract'
import { propertyRuns } from '~~/shared/testing/property'
import type { TrialResult } from '~~/shared/types'
import definition from './definition'
import {
  ABLENKER,
  DETAIL_POOL,
  ITEM_TYPES,
  KONTUREN,
  ORT_RADIUS,
  ORT_WINKEL,
  REGION_RADIUS,
  ZIEL,
  figureToSvg,
  generateFigurenBlock,
  naechsteStufe,
  schnittToSvg,
  type AblenkArt,
  type DetailSpec,
  type FigurenBlock,
  type SchnittPayload,
} from './generator'

const STUFEN = [1, 2, 3, 4, 5]

const FIGUREN_ERWARTET: Record<number, number> = { 1: 3, 2: 4, 3: 5, 4: 6, 5: 8 }
const LERNZEIT_ERWARTET: Record<number, number> = {
  1: 15000,
  2: 18000,
  3: 20000,
  4: 22500,
  5: 25000,
}
const ABSTAND_ERWARTET: Record<number, number> = { 1: 3, 2: 3, 3: 2, 4: 2, 5: 1 }

function merkmale(detail: DetailSpec): number[] {
  return [detail.arme, detail.drehung, detail.knoten, detail.bogen, detail.fuellung]
}

function unterschiede(a: DetailSpec, b: DetailSpec): number {
  const links = merkmale(a)
  const rechts = merkmale(b)
  let count = 0
  for (let i = 0; i < links.length; i++) {
    if (links[i] !== rechts[i]) count++
  }
  return count
}

function naechsterAbstand(detail: DetailSpec, gelernt: readonly DetailSpec[]): number {
  let best = merkmale(detail).length
  for (const other of gelernt) {
    const abstand = unterschiede(detail, other)
    if (abstand < best) best = abstand
  }
  return best
}

function block(difficulty: number, run: number): FigurenBlock {
  return generateFigurenBlock(difficulty, createRng(run * 2654435761 + difficulty))
}

function gelerntVon(satz: FigurenBlock): DetailSpec[] {
  return satz.payload.figuren.map((figur) => figur.detail)
}

function schnittVon(trial: { payload: SchnittPayload }): DetailSpec {
  return trial.payload.schnitt
}

function ecke(radius: number, winkel: number): [number, number] {
  const bogenmass = (winkel * Math.PI) / 180
  return [Math.cos(bogenmass) * radius, -Math.sin(bogenmass) * radius]
}

function nachrechnen(art: AblenkArt, a: number, b: number): number {
  if (art === 'mal') {
    let summe = 0
    for (let i = 0; i < b; i++) summe += a
    return summe
  }
  let wert = a
  for (let i = 0; i < b; i++) wert += art === 'plus' ? 1 : -1
  return wert
}

describe('figurenlernen generator', () => {
  it(
    'satisfies the shared generator contract',
    () => {
      runGeneratorContract(definition, {
        minItemTypes: ITEM_TYPES.length,
        checkTrial: (trial) => {
          expect(typeof trial.answer).toBe('boolean')
          const payload = trial.payload as SchnittPayload
          expect(payload.nummer).toBeGreaterThanOrEqual(1)
          expect(payload.nummer).toBeLessThanOrEqual(payload.gesamt)
          expect(payload.gesamt).toBeGreaterThanOrEqual(6)
        },
      })
    },
    120000,
  )

  it('zeigt genau zur Haelfte Ausschnitte aus dem Lernsatz', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const stufe = STUFEN[i % STUFEN.length]!
      const satz = block(stufe, i)
      const anzahlFiguren = satz.payload.figuren.length

      expect(satz.trials.length).toBe(anzahlFiguren * 2)

      let ziele = 0
      let ablenker = 0
      for (const trial of satz.trials) {
        if (trial.answer === true) ziele++
        else ablenker++
      }
      expect(ziele).toBe(satz.trials.length / 2)
      expect(ablenker).toBe(satz.trials.length / 2)
      expect(ziele).toBe(anzahlFiguren)
    }
  })

  it('holt jeden Zielausschnitt aus einer gelernten Figur und keinen Ablenker', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const stufe = STUFEN[i % STUFEN.length]!
      const satz = block(stufe, i)
      const gelernt = gelerntVon(satz)

      for (const trial of satz.trials) {
        const schnitt = schnittVon(trial)
        const stammtAusLernsatz = gelernt.some((detail) => unterschiede(detail, schnitt) === 0)
        expect(stammtAusLernsatz).toBe(trial.answer === true)
        expect(trial.itemType).toBe(trial.answer === true ? ZIEL : ABLENKER)
        expect(trial.params.ziel).toBe(trial.answer)
      }
    }
  })

  it('zeigt keinen Ausschnitt zweimal', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const stufe = STUFEN[i % STUFEN.length]!
      const satz = block(stufe, i)
      const schluessel = satz.trials.map((trial) => merkmale(schnittVon(trial)).join('.'))
      expect(new Set(schluessel).size).toBe(schluessel.length)
    }
  })

  it('lernt lauter verschiedene Figuren', () => {
    const runs = Math.min(propertyRuns(), 400)
    for (let i = 0; i < runs; i++) {
      const stufe = STUFEN[i % STUFEN.length]!
      const satz = block(stufe, i)

      const bilder = satz.payload.figuren.map((figur) => figureToSvg(figur))
      expect(new Set(bilder).size).toBe(bilder.length)

      const details = gelerntVon(satz).map((detail) => merkmale(detail).join('.'))
      expect(new Set(details).size).toBe(details.length)
    }
  })

  it('rendert jeden Zielausschnitt genau wie den Ausschnitt seiner Figur', () => {
    const runs = Math.min(propertyRuns(), 400)
    for (let i = 0; i < runs; i++) {
      const stufe = STUFEN[i % STUFEN.length]!
      const satz = block(stufe, i)
      const gelernteBilder = new Set(gelerntVon(satz).map((detail) => schnittToSvg(detail)))

      for (const trial of satz.trials) {
        const bild = schnittToSvg(schnittVon(trial))
        expect(gelernteBilder.has(bild)).toBe(trial.answer === true)
      }
    }
  })

  it('gibt jeder der 192 Detailformen ein eigenes Bild', () => {
    expect(DETAIL_POOL.length).toBe(4 * 4 * 3 * 2 * 2)

    const schluessel = DETAIL_POOL.map((detail) => merkmale(detail).join('.'))
    expect(new Set(schluessel).size).toBe(DETAIL_POOL.length)

    const bilder = DETAIL_POOL.map((detail) => schnittToSvg(detail))
    expect(new Set(bilder).size).toBe(DETAIL_POOL.length)
  })

  it('richtet die Anzahl Figuren und die Lernzeit nach der Schwierigkeit', () => {
    let vorher = 0
    for (const stufe of STUFEN) {
      const satz = block(stufe, 4711)
      expect(satz.payload.figuren.length).toBe(FIGUREN_ERWARTET[stufe]!)
      expect(satz.payload.lernzeitMs).toBe(LERNZEIT_ERWARTET[stufe]!)
      expect(satz.payload.lernzeitMs % satz.payload.figuren.length).toBe(0)
      expect(satz.payload.figuren.length).toBeGreaterThan(vorher)
      vorher = satz.payload.figuren.length
    }
    expect(FIGUREN_ERWARTET[1]).toBe(3)
    expect(FIGUREN_ERWARTET[5]).toBe(8)
    expect(LERNZEIT_ERWARTET[1]).toBeGreaterThanOrEqual(15000)
    expect(LERNZEIT_ERWARTET[5]).toBeLessThanOrEqual(25000)
  })

  it('macht die Ablenker mit steigender Schwierigkeit aehnlicher', () => {
    const runs = Math.min(propertyRuns(), 2000)
    const summe: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    const zaehler: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }

    for (let i = 0; i < runs; i++) {
      const stufe = STUFEN[i % STUFEN.length]!
      const satz = block(stufe, i)
      const gelernt = gelerntVon(satz)

      for (const trial of satz.trials) {
        const abstand = naechsterAbstand(schnittVon(trial), gelernt)
        expect(trial.params.abstand).toBe(abstand)
        if (trial.answer === true) {
          expect(abstand).toBe(0)
          continue
        }
        expect(abstand).toBeGreaterThanOrEqual(1)
        expect(abstand).toBeLessThanOrEqual(ABSTAND_ERWARTET[stufe]!)
        summe[stufe] = summe[stufe]! + abstand
        zaehler[stufe] = zaehler[stufe]! + 1
      }
    }

    const mittel = (stufe: number) => summe[stufe]! / zaehler[stufe]!
    expect(mittel(5)).toBe(1)
    expect(mittel(1)).toBeGreaterThan(mittel(3))
    expect(mittel(3)).toBeGreaterThan(mittel(5))
  })

  it('empfiehlt nach dem Durchgang eine Stufe fuer das naechste Mal', () => {
    const faelle: [number, number, number][] = [
      [1, 1, 2],
      [1, 0.9, 2],
      [1, 0.85, 2],
      [1, 0.84, 1],
      [1, 0.6, 1],
      [1, 0.55, 1],
      [1, 0, 1],
      [3, 1, 4],
      [3, 0.7, 3],
      [3, 0.56, 3],
      [3, 0.55, 2],
      [3, 0, 2],
      [5, 1, 5],
      [5, 0.7, 5],
      [5, 0.4, 4],
    ]
    for (const [stufe, rate, erwartet] of faelle) {
      expect(naechsteStufe(stufe, rate), `Stufe ${stufe} mit Rate ${rate}`).toBe(erwartet)
    }
  })

  it('erreicht mit guten Durchgaengen jede vorgesehene Figurenzahl', () => {
    const gesehen = new Set<number>()
    let stufe = 1
    for (let i = 0; i < 12; i++) {
      gesehen.add(generateFigurenBlock(stufe, createRng(i + 1)).payload.figuren.length)
      stufe = naechsteStufe(stufe, 0.95)
    }
    expect([...gesehen].sort((a, b) => a - b)).toEqual([3, 4, 5, 6, 8])
    expect(stufe).toBe(5)
  })

  it('erreicht beide Aufgabenarten schon auf der untersten Stufe', () => {
    const runs = Math.min(propertyRuns(), 400)
    const gesehen = new Set<string>()
    for (let i = 0; i < runs; i++) {
      const satz = block(1, i)
      const arten = new Set(satz.trials.map((trial) => trial.itemType))
      expect([...arten].sort()).toEqual([ABLENKER, ZIEL].sort())
      for (const art of arten) gesehen.add(art)
    }
    expect([...gesehen].sort()).toEqual([ABLENKER, ZIEL].sort())
  })

  it('haelt jede Kontur von der markierten Region fern', () => {
    const schritte = 240
    let engster = Number.POSITIVE_INFINITY

    for (const radien of KONTUREN) {
      const ecken = radien.map((radius, index) => ecke(radius, (360 / radien.length) * index))
      for (const winkel of ORT_WINKEL) {
        const [ax, ay] = ecke(ORT_RADIUS, winkel)
        for (let i = 0; i < ecken.length; i++) {
          const [x1, y1] = ecken[i]!
          const [x2, y2] = ecken[(i + 1) % ecken.length]!
          for (let s = 0; s <= schritte; s++) {
            const t = s / schritte
            const dx = x1 + (x2 - x1) * t - ax
            const dy = y1 + (y2 - y1) * t - ay
            const abstand = Math.sqrt(dx * dx + dy * dy)
            if (abstand < engster) engster = abstand
          }
        }
      }
    }

    expect(engster).toBeGreaterThan(REGION_RADIUS)
  })

  it('haelt die vier Orte weit genug auseinander', () => {
    const fuellerRadius = 8
    for (let a = 0; a < ORT_WINKEL.length; a++) {
      const [ax, ay] = ecke(ORT_RADIUS, ORT_WINKEL[a]!)
      for (let b = 0; b < ORT_WINKEL.length; b++) {
        if (a === b) continue
        const [bx, by] = ecke(ORT_RADIUS, ORT_WINKEL[b]!)
        const abstand = Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2)
        expect(abstand - fuellerRadius).toBeGreaterThan(REGION_RADIUS)
      }
      expect(ORT_RADIUS - fuellerRadius).toBeGreaterThan(0)
    }
  })

  it('stellt eine loesbare Zwischenrechnung mit genau einer richtigen Zahl', () => {
    const runs = Math.min(propertyRuns(), 600)
    const arten = new Set<string>()

    for (let i = 0; i < runs; i++) {
      const stufe = STUFEN[i % STUFEN.length]!
      const satz = block(stufe, i)
      expect(satz.payload.ablenkzeitMs).toBe(20000)
      expect(satz.payload.ablenkung.length).toBeGreaterThanOrEqual(8)

      for (const aufgabe of satz.payload.ablenkung) {
        arten.add(aufgabe.art)
        expect(aufgabe.loesung).toBe(nachrechnen(aufgabe.art, aufgabe.a, aufgabe.b))
        expect(aufgabe.optionen.length).toBe(3)
        expect(new Set(aufgabe.optionen).size).toBe(3)
        expect(aufgabe.optionen[aufgabe.richtig]).toBe(aufgabe.loesung)
        expect(aufgabe.optionen.filter((wert) => wert === aufgabe.loesung).length).toBe(1)
        for (const wert of aufgabe.optionen) {
          expect(wert).toBeGreaterThan(0)
          expect(Number.isInteger(wert)).toBe(true)
        }
        expect(aufgabe.text).toContain(String(aufgabe.a))
        expect(aufgabe.text).toContain(String(aufgabe.b))
      }
    }

    expect([...arten].sort()).toEqual(['mal', 'minus', 'plus'])
  })

  it('setzt die Kennwerte in die Parameter jedes Ausschnitts', () => {
    const runs = Math.min(propertyRuns(), 600)
    for (let i = 0; i < runs; i++) {
      const stufe = STUFEN[i % STUFEN.length]!
      const satz = block(stufe, i)
      for (const trial of satz.trials) {
        expect(trial.params.lernzeitMs).toBe(LERNZEIT_ERWARTET[stufe]!)
        expect(trial.params.anzahlFiguren).toBe(FIGUREN_ERWARTET[stufe]!)
        expect(trial.params.type).toBe(trial.itemType)
        expect(trial.difficulty).toBe(stufe)
      }
    }
  })
})

describe('figurenlernen scoring', () => {
  function ergebnis(ziel: boolean, gesehen: boolean): TrialResult {
    return {
      idx: 0,
      itemType: ziel ? ZIEL : ABLENKER,
      difficulty: 3,
      params: { type: ziel ? ZIEL : ABLENKER, ziel, lernzeitMs: 20000, anzahlFiguren: 5 },
      response: gesehen,
      correct: gesehen === ziel,
      rtMs: 900,
      presentedAt: 0,
    }
  }

  it('rechnet drei Treffer minus einen Fehlalarm auf vier Ziele als 0.5', () => {
    const trials = [
      ergebnis(true, true),
      ergebnis(true, true),
      ergebnis(true, true),
      ergebnis(true, false),
      ergebnis(false, true),
      ergebnis(false, false),
      ergebnis(false, false),
      ergebnis(false, false),
    ]
    const score = definition.score(trials, 120)
    expect(score.raw).toBe(0.5)
    expect(score.accuracy).toBe(0.75)
    expect(score.metrics.treffer).toBe(3)
    expect(score.metrics.falscheAlarme).toBe(1)
    expect(score.metrics.korrigierteRate).toBe(0.5)
    expect(score.metrics.lernzeitMs).toBe(20000)
    expect(score.metrics.anzahlFiguren).toBe(5)
  })

  it('gibt bei lauter Treffern ohne Fehlalarm genau 1', () => {
    const trials = [
      ergebnis(true, true),
      ergebnis(true, true),
      ergebnis(false, false),
      ergebnis(false, false),
    ]
    const score = definition.score(trials, 120)
    expect(score.raw).toBe(1)
    expect(score.accuracy).toBe(1)
    expect(score.metrics.falscheAlarme).toBe(0)
  })

  it('kappt eine negative Bilanz bei null', () => {
    const trials = [
      ergebnis(true, true),
      ergebnis(true, false),
      ergebnis(true, false),
      ergebnis(true, false),
      ergebnis(false, true),
      ergebnis(false, true),
      ergebnis(false, true),
      ergebnis(false, true),
    ]
    const score = definition.score(trials, 120)
    expect(score.raw).toBe(0)
    expect(score.metrics.treffer).toBe(1)
    expect(score.metrics.falscheAlarme).toBe(4)
  })

  it('bleibt ein Anteil und kein Durchsatz pro Minute', () => {
    const trials = [
      ergebnis(true, true),
      ergebnis(true, false),
      ergebnis(false, false),
      ergebnis(false, false),
    ]
    const kurz = definition.score(trials, 30)
    const lang = definition.score(trials, 600)
    expect(kurz.raw).toBe(0.5)
    expect(lang.raw).toBe(0.5)
    expect(kurz.raw).toBe(lang.raw)
  })

  it('meldet null fuer einen leeren Durchgang', () => {
    const score = definition.score([], 120)
    expect(score.raw).toBe(0)
    expect(score.accuracy).toBe(0)
    expect(score.metrics.treffer).toBe(0)
    expect(score.metrics.falscheAlarme).toBe(0)
    expect(score.metrics.anzahlFiguren).toBe(0)
  })

  it('trifft mit den Schwellen die Bestehensgrenze', () => {
    expect(definition.thresholds.raw1).toBe(0.3)
    expect(definition.thresholds.raw4).toBe(0.62)
    expect(definition.thresholds.raw6).toBe(0.9)
    expect(definition.itemCount).toBe(1)
    expect(definition.mode).toBe('block')
    expect(definition.defaultDurationS).toBe(300)
    expect(definition.weight(5)).toBeGreaterThan(definition.weight(1))
  })
})
