# Spielkatalog

Ein Abschnitt pro Spiel: Konstrukt, Aufgabenformat, Schwierigkeitsachse, Gewichtskurve und
Punkteberechnung.

## Gemeinsame Regeln

**Aufbau.** Jedes Spiel ist ein Ordner unter `app/games/<slug>/` mit vier Dateien:
`definition.ts` (Metadaten, Schwellen, Gewicht, Punkteberechnung), `generator.ts` (erzeugt Items),
`Play.vue` (Oberflaeche) und `generator.test.ts` (Property-Tests). Ein neues Spiel wird in
`app/games/index.ts` eingetragen; `app/games/catalog.test.ts` schlaegt fehl, wenn das vergessen
geht.

**Rohwert.** Ausser bei Spannenverfahren gilt

```
rawScore = summe(weight(difficulty) fuer korrekt geloeste Items) / dauerMinuten
```

Falsche Antworten zaehlen nicht negativ, kosten aber Zeit und druecken damit den Durchsatz.

**Note.** Der Rohwert wird ueber `thresholds` auf 1 bis 6 abgebildet, stueckweise linear mit
`raw4` exakt auf der Bestehensgrenze 4.0. Ab zwanzig Sessions pro Spiel ersetzt die persoenliche
Normierung diese Schwellen (z-Wert gegen die eigene Verteilung der letzten neunzig Tage, Anker:
Median der ersten zehn Sessions entspricht 4.0). Welche Quelle gilt, steht in der Oberflaeche.

**Schwierigkeit.** Staircase, zwei richtige Antworten in Folge erhoehen, eine falsche senkt. Das
konvergiert theoretisch gegen rund 70.7 Prozent Trefferquote und liegt damit im beabsichtigten
Band um 75 Prozent. Bei Spannenverfahren ist die Spannenlaenge selbst die Schwierigkeit.

**Distraktoren.** Wo Multiple Choice vorkommt: genau eine Antwort ist eindeutig richtig, alle
Distraktoren entstehen aus typischen Fehlern, nie aus Zufallszahlen. Der geteilte Contract-Test
prueft ausserdem, dass keine Option doppelt vorkommt und die richtige Antwort nicht systematisch
an derselben Position steht.

---

## kopfrechnen, Kopfrechnen

**Konstrukt** Rechnerisches Denken
**Modus** `sprint`, 120 Sekunden
**Schwierigkeit** 1 bis 10
**Gewicht** linear von 1.0 bei Stufe 1 auf 3.0 bei Stufe 10
**Schwellen** `raw1: 3`, `raw4: 14`, `raw6: 32`, also rund vierzehn gewichtete Loesungen pro
Minute fuer eine 4.0. Vorlaeufig, wird durch die persoenliche Normierung abgeloest.

**Eingabe** eigener Ziffernblock, keine Systemtastatur, ganzzahlige Loesungen.

**Elf Aufgabentypen**, alle mit garantiert ganzzahliger Loesung:

| `item_type` | Format | Konstruktion der Ganzzahligkeit |
|---|---|---|
| `prozentwert` | `p % von g` | `g` ist Vielfaches von `100/ggT(p,100)` |
| `prozentsatz` | Wie viel Prozent sind `t` von `g` | aus `p` und `g` rueckwaerts gerechnet |
| `grundwert` | `t` sind `p %` von wie viel | dito |
| `bruchteil` | `a/b von n` | `n` ist Vielfaches von `b` |
| `multiplikation` | `a × b` | trivial |
| `division` | `a : b` | Dividend als `b · q` konstruiert |
| `dreisatz` | `n` Stueck kosten `X`, was kosten `m` | Stueckpreis ist ganzzahlig gewaehlt |
| `zuschlag` | `X` um `p %` erhoeht | wie `prozentwert` |
| `rabatt` | `X` um `p %` reduziert | wie `prozentwert` |
| `geschwindigkeit` | Weg, Tempo oder Zeit gesucht | `s = v · t` mit ganzzahligen Faktoren |
| `mischung` | zwei Mengen mit zwei Prozentwerten | ueber `p1 = r + b'm`, `p2 = r - a'm` mit `a' = a/ggT`, `b' = b/ggT` |

**Schwierigkeitsachse** vier Stufen. Sie steuert gleichzeitig den Zahlenraum (Stufe 1: einstellig
mal einstellig; Stufe 10: zweistellig mal zweistellig) und die Sperrigkeit der Prozentsaetze
(Stufe 1: nur 10, 50, 100; Stufe 10 auch 4, 8, 12, 35, 45, 65, 85, 95). Auf der untersten Stufe
sind `mischung` und `grundwert` ausgeschlossen, weil sie dort keinen sinnvollen Zahlenraum haben.

**Punkteberechnung** gewichteter Durchsatz. Zusaetzliche Kennwerte in `metrics`: `attempted`,
`correct`, `medianRtMs`, `meanDifficulty`.

**Getestet** ueber den geteilten Contract plus vier eigene Property-Tests: jede Loesung ist
ganzzahlig und nicht negativ, jeder Prozentwert liegt zwischen 0 und 100, die Arithmetik jedes
einzelnen Aufgabentyps wird unabhaengig nachgerechnet, und der Zahlenraum waechst nachweislich
mit der Schwierigkeit.
