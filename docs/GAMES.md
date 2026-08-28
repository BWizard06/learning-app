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

---

## zahlenreihen, Zahlenreihen

**Konstrukt** Logisches Denken
**Modus** `sprint`, 120 Sekunden
**Schwierigkeit** 1 bis 12
**Gewicht** linear von 1.0 auf 3.2
**Schwellen** `raw1: 1.5`, `raw4: 7`, `raw6: 16`

**Eingabe** Ziffernblock mit Vorzeichenwechsel, ganzzahlige Loesungen.

**Zwoelf Bildungsgesetze**, jedes ein eigener `item_type`: `konstante-differenz`,
`konstanter-faktor`, `alternierende-schritte`, `zweite-differenz`, `differenzreihe`,
`verschachtelt`, `fibonacci-artig`, `quadratzahlen-versatz`, `kubikzahlen-versatz`,
`mult-add-wechsel`, `mult-plus-konstante`, `primzahl-versatz`.

**Schwierigkeitsachse** steuert dreierlei: welche Gesetze ueberhaupt vorkommen (auf den untersten
Stufen nur die drei einfachen), den Zahlenraum, und ob negative Terme und groessere Faktoren
auftreten. Jeder Term und die Loesung bleiben innerhalb von plus minus 100000.

**Das eigentliche Qualitaetsproblem bei Zahlenreihen ist Mehrdeutigkeit**: eine Reihe, auf die
auch ein einfacheres Gesetz passt, hat zwei vertretbare Antworten und misst dann nichts. Dagegen
laufen drei unabhaengige Tests, die im Testfile selbst nachrechnen und nicht die Generatorlogik
wiederverwenden: keine gezeigte Reihe darf zusaetzlich durch eine konstante Differenz erklaerbar
sein, keine durch einen konstanten Faktor, und keine durch eine konstante zweite Differenz, die
auf einen anderen naechsten Wert zeigt. Dazu kommt eine Mindestanzahl gezeigter Terme pro Gesetz.

**Punkteberechnung** gewichteter Durchsatz. Kennwerte: `attempted`, `correct`, `medianRtMs`,
`meanDifficulty`.

**Offene Punkte, ehrlich benannt.** Drei der zwoelf Gesetze (`zweite-differenz`,
`differenzreihe`, `quadratzahlen-versatz`) sind mathematisch dieselbe Regel, naemlich eine
konstante zweite Differenz; sie unterscheiden sich nur in der Bauart, nicht im Denkschritt. Fuer
die Schwachstellenanalyse sind das trotzdem drei getrennte Eintraege, was den Befund verwaessern
kann. Ausserdem sind die zwoelf Schwierigkeitsstufen in vier Stufengruppen organisiert, also gibt
es real vier Niveaus statt zwoelf. Beides ist eine Inhaltsentscheidung, keine Fehlfunktion, und
bleibt fuer eine spaetere Ueberarbeitung notiert.

---

## wortfluss, Wortflüssigkeit

**Konstrukt** Wortfluessigkeit
**Modus** `sprint`, 60 Sekunden
**Schwierigkeit** 1 bis 3
**Gewicht** linear von 1.0 auf 1.6
**Schwellen** `raw1: 2`, `raw4: 11`, `raw6: 22`

**Drei Aufgabenformen**: `buchstabe` (alle Woerter mit einem vorgegebenen Anfangsbuchstaben),
`kategorie` (alle Woerter aus einer Kategorie), `kombiniert` (Kategorie und Anfangsbuchstabe
zugleich). Welche Form drankommt, **rotiert ueber den Session-Seed**, nicht ueber die
Schwierigkeit.

**Warum das korrigiert wurde:** urspruenglich waren die drei Formen als Schwierigkeitsstufen 1,
2 und 3 definiert. Das war ein Denkfehler: es sind drei verschiedene Aufgabenformen, keine
Steigerung. Schlimmer noch, es machte zwei davon zu totem Inhalt, weil dieses Spiel pro Session
nur eine einzige Aufgabenstellung hat, die Staircase deshalb nie greift und die gespeicherte
Schwierigkeit auf 1 stehen blieb. `kategorie` und `kombiniert` waeren nie erschienen. Jetzt
kommen alle drei ab der ersten Session vor, und ein Test prueft genau das.

**Die Schwierigkeit wirkt jetzt innerhalb der Form**: auf Stufe 1 kommen nur haeufige
Anfangsbuchstaben, ab Stufe 2 der volle Vorrat inklusive der duennen.

**Eingabe** das einzige Spiel mit einem echten Textfeld statt Ziffernblock. Schriftgroesse
mindestens 16 px, damit iOS nicht zoomt, Autokorrektur und Autokapitalisierung aus.

**Zaehlung** rein strukturell, weil bewusst keine Wortliste im Projekt liegt. Geprueft wird:
mindestens drei Zeichen, nur Buchstaben inklusive Umlauten und Bindestrich, keine Dublette ohne
Ruecksicht auf Gross- und Kleinschreibung, und bei `buchstabe` und `kombiniert` der geforderte
Anfangsbuchstabe. Abgelehnte Eingaben nennen den Grund und werden nicht gezaehlt.

**Was bewusst nicht geprueft wird:** ob ein Wort wirklich in die Kategorie gehoert und ob es
ueberhaupt ein Wort ist. Ohne Lexikon geht das nicht, und die Oberflaeche sagt das in einem Satz.
Die Zahl ist damit eine Selbstauskunft, kein Testwert. Eine frei lizenzierte deutsche Wortliste
wuerde beides freischalten, sie ist der billigste Nachschlag im ganzen Projekt.

Die Wortpruefung akzeptiert absichtlich auch `ß`, weil das eine gueltige Eingabe ist. Die
Schweizer Schreibweise gilt fuer die Texte der App, nicht fuer das, was du tippen darfst.

**Punkteberechnung** angenommene Woerter pro Minute, gewichtet. Kennwerte: `accepted`,
`rejected`, `uniqueCount`, `meanRtMs`.

---

## d2, Durchstreichtest

**Konstrukt** Konzentrationsleistung
**Modus** `block`, zehn Zeilen, Zeit wird gemessen
**Schwierigkeit** 1 bis 6
**Gewicht** linear von 1.0 auf 2.0
**Schwellen** `raw1: 8`, `raw4: 30`, `raw6: 60`

Nachgebaut ist das **Paradigma** aus der Fachliteratur, nicht das kommerzielle Testkit. Keine
Originalmaterialien, keine Normtabellen, keine Testboegen. Alle Zeichen werden erzeugt.

**Aufgabenformat** jedes Zeichen ist ein d oder ein p mit ein bis vier Strichen ueber und unter
dem Buchstaben. Ziel ist ausschliesslich: **d mit genau zwei Strichen**, gleich ob zwei oben,
zwei unten oder je einer. Die Zielquote liegt bei rund 45 Prozent. Die klassischen Verwechslungen
sind bewusst haeufig: d mit einem, drei oder vier Strichen, und p mit genau zwei.

**Bedienung** eine Zeile auf einmal, 16 bis 24 Zeichen je nach Schwierigkeit. Antippen markiert
und hebt die Markierung wieder auf, ein Fehler laesst sich also vor dem Abschluss korrigieren.
«Zeile fertig» schliesst die Zeile ab. Gemessen: 48 mal 60 px pro Zeichen, kein horizontales
Scrollen.

**Kennwerte**, und die sind der eigentliche Zweck des Spiels: `treffer`, `auslassungen`
(uebersehene Ziele), `verwechslungen` (markierte Nichtziele), `bearbeitet`, `fehlerprozent` und
`schwankungsbreite` als Spanne zwischen schnellster und langsamster Zeile. Genau die
Schwankungsbreite ist das, was Konzentration von blossem Tempo unterscheidet.

**Punkteberechnung, bewusste Ausnahme von der allgemeinen Formel:** Treffer minus Fehler pro
Minute, gewichtet, nach unten bei null begrenzt. Die Hausregel «nur korrekt geloeste Items
zaehlen, Fehler kosten nur Zeit» passt hier nicht, weil bei einem Durchstreichtest das
Uebersehen und das faelschliche Markieren die eigentliche Messgroesse sind. Ein Durchgang, bei
dem man einfach alles markiert, muss schlechter abschneiden als einer mit sorgfaeltiger Auswahl.

---

## symbolzahl, Zahlen-Symbol

**Konstrukt** Konzentrationsleistung
**Modus** `sprint`, 90 Sekunden
**Schwierigkeit** 1 bis 4
**Gewicht** linear von 1.0 auf 1.5
**Schwellen** `raw1: 8`, `raw4: 26`, `raw6: 50`

**Aufgabenformat** eine Legende ordnet neun erzeugte SVG-Zeichen den Ziffern 1 bis 9 zu und
bleibt die ganze Zeit sichtbar. Darunter erscheint ein Zeichen nach dem anderen, eingegeben wird
die passende Ziffer. Ein Tastendruck ist eine Antwort, ohne Bestaetigung.

**Die Legende wird pro Session neu gewuerfelt**, damit sie sich nicht ueber Wochen einpraegt,
muss aber innerhalb einer Session unveraendert bleiben. Sie wird deshalb aus `rng.seed` abgeleitet
und nicht aus `rng.next()`, denn dessen Zustand wandert von Item zu Item weiter. Ein Test ruft
`generate` viele Male mit demselben Rng auf und prueft, dass die Permutation sich nie aendert.

**Schwierigkeitsachse** wie aehnlich sich die verwendeten Zeichen sehen. Die urspruenglich
zusaetzlich vorgesehene Achse «Legende in Ziffernreihenfolge oder gemischt» wurde wieder
entfernt: sie haette die Legendenreihenfolge an die Schwierigkeit gekoppelt, die sich waehrend
einer Session aendert, und damit die Tabelle mitten im Durchgang umsortiert.

**Punkteberechnung** richtige Zuordnungen pro Minute, gewichtet. Kennwerte: `attempted`,
`correct`, `medianRtMs`, `meanRtMs`.

---

## matrizen, Matrizen

**Konstrukt** Logisches Denken
**Modus** `sprint`, 180 Sekunden
**Schwierigkeit** 1 bis 10
**Gewicht** linear von 1.0 auf 3.0
**Schwellen** `raw1: 0.8`, `raw4: 3.5`, `raw6: 8`

**Aufgabenformat** ein 3x3-Raster aus erzeugten SVG-Feldern nach Raven-Prinzip, das Feld unten
rechts fehlt, sechs Antwortoptionen. Die Regeln greifen zeilen- **und** spaltenweise.

**Merkmale je Feld**: `shape`, `count`, `fill`, `rotation`, `size`.
**Regelarten**: `konstant`, `konstant-in-zeile`, `progression` (fester Schritt entlang der Zeile)
und `verteilung` (jeder von drei Werten kommt genau einmal pro Zeile und pro Spalte vor).
`count` und `rotation` koennen zusaetzlich als Progression laufen.

**Schwierigkeitsachse** wie viele Merkmale ueberhaupt eine Regel tragen, von einem auf der
untersten Stufe bis drei auf der obersten. Die schwerere `verteilung` erscheint erst ab Stufe
vier.

**Die Distraktoren sind der heikle Teil.** Jede der fuenf falschen Optionen entsteht daraus, dass
genau ein regeltragendes Merkmal auf einen Wert gesetzt wird, der unter einer **falschen aber
naheliegenden Lesart** richtig waere: der Wert aus der Zeile darueber, der Wert aus dem linken
Nachbarn, der naechste statt des aktuellen Progressionsschritts, oder der wiederholte Wert des
Vorgaengers. Nie ein Zufallswert.

**Was die Tests wirklich pruefen**, unabhaengig von der Generatorlogik: dass die richtige Option
jede Regel sowohl in ihrer Zeile als auch in ihrer Spalte erfuellt, dass alle sechs
Merkmalsvektoren verschieden sind, dass jeder Distraktor sich in genau einem regeltragenden
Merkmal unterscheidet, und dass jeder moegliche Merkmalsvektor ein optisch unterscheidbares SVG
ergibt. Der letzte Punkt ist wichtig, weil zwei verschiedene Vektoren sonst identisch aussehen
koennten und die Aufgabe zwei richtige Antworten haette.

**Punkteberechnung** gewichteter Durchsatz. Kennwerte wie bei den uebrigen Sprintspielen.
