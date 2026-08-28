# Entscheidungen

Chronologisch, neueste zuoberst. Jeder Eintrag nennt die Entscheidung, den Grund und was sie
kostet.

---

## Phase 1, Fundament

### Zwei geplante Abweichungen wurden nach Pruefung zurueckgenommen

**`node:sqlite` zurueck zu `better-sqlite3`.** Der Plan sah `drizzle-orm/node-sqlite` vor. Die
Pruefung gegen `node_modules` zeigte: dieser Treiber existiert nur in der unveroeffentlichten
`1.0.0-rc`-Linie von Drizzle, die stabile 0.45.2 kennt ihn nicht. Zusaetzlich war der eigentliche
Grund fuer die Abweichung entfallen, weil das Image auf kumo gebaut wird und ein natives Modul
dort unproblematisch ist. `better-sqlite3` 13.0.3 bringt ausserdem einen fertigen
`linux-x64`-Prebuild mit, der Build auf kumo muss also gar nichts kompilieren.
**Lernpunkt:** kuenftig gegen `node_modules` verifizieren, nicht gegen Dokumentation.

**Property-Tests bleiben bei 10'000 Durchlaeufen.** Der Plan wollte im Alltag auf 1'000 senken,
weil 10'000 zu langsam schienen. Gemessen am fertigen `kopfrechnen`: sieben Tests mit je 10'000
Durchlaeufen brauchen 667 ms. Damit ist die Abweichung gegenstandslos. `npm test` faehrt die
beauftragten 10'000, `npm run test:watch` senkt fuer schnelles Tippen auf 300.

### Node 24 statt Node 22

Bleibt als einzige Stack-Abweichung bestehen, jetzt aber nur noch aus Konsistenz: 24 ist ebenfalls
LTS und entspricht der lokalen Entwicklungsumgebung. Kein technischer Zwang. Rueckweg ist eine
Zeile im Dockerfile.

### Reine Logik liegt in `shared/`, nicht in `server/services/`

`scoring.ts` und `adaptive.ts` enthalten reine Funktionen, die der Client fuer die Sofortanzeige
und die Staircase braucht. Sie liegen deshalb in `shared/`; `server/services/scoring.ts` und
`server/services/adaptive.ts` sind Re-Exports, damit die Pfade aus dem Plan bestehen bleiben. So
zieht der Client-Bundle kein `server/`-Modul.

### Der Spielkatalog ist eine explizite Liste, kein `import.meta.glob`

Erster Entwurf registrierte Spiele automatisch ueber `import.meta.glob('./*/definition.ts')`. Das
ist ein Vite-Feature und funktioniert im Nitro-Server nicht, der die Definitionen aber fuer die
Notenschwellen braucht. Jetzt ist `app/games/index.ts` eine explizite Liste, die beide Seiten
nutzen; `app/games/registry.ts` ergaenzt nur das clientseitige Nachladen der `Play.vue`.
Gegen das Veralten der Liste sichert `app/games/catalog.test.ts` ab: der Test vergleicht die
registrierten Slugs mit den tatsaechlich vorhandenen Ordnern und verlangt zu jedem Spiel eine
`Play.vue` und eine `generator.test.ts`.

### Der Rohwert enthaelt die Schwierigkeit

Umgesetzt wie im Plan begruendet: `rawScore` ist ein schwierigkeitsgewichteter Durchsatz
(`weightedThroughput`). Ohne das haelt die Staircase die Trefferquote bei rund 75 Prozent und die
Note bleibt trotz Fortschritt konstant. Ein Test in `shared/scoring.test.ts` haelt genau das fest:
gleiche Trefferquote, hoehere Schwierigkeit, hoeherer Rohwert.

### `day_log` ist ein Cache

Wird beim Schreiben einer Session neu berechnet und laesst sich mit `rebuildDayLog` jederzeit
vollstaendig aus `sessions` rekonstruieren. Ein Test loescht die Tabelle und vergleicht den
Wiederaufbau mit dem vorherigen Zustand.

### Zeitzone ist ein eigenes Modul mit eigenen Tests

`shared/dates.ts` rechnet Tagesgrenzen, Streak und Tageszeit in Europe/Zurich, waehrend alle
Zeitstempel als UTC-Epoch in Millisekunden gespeichert werden. Getestet ist ausdruecklich beides
Zeitumstellungen: der 29. Maerz 2026 hat 23 Stunden, der 25. Oktober 2026 hat 25, und ein
Rundlauf ueber 365 Tage bleibt korrekt. Ohne das waeren Streak und die 17:30-Analyse still falsch.

### Zwei Fehler, die erst der Browsertest gezeigt hat

**Die Sprint-Uhr blieb stehen, wenn der Tab nicht sichtbar war.** Die Engine benutzte
`requestAnimationFrame` als Sessionuhr. Browser halten rAF in unsichtbaren Tabs an, also lief eine
Session nie ab, wenn man die App zwischendurch weglegt. Jetzt gilt die Aufteilung: rAF nur fuer
die fluessige Anzeige, ein `setTimeout` auf den Ablaufzeitpunkt als verlaesslicher Wecker, und ein
`visibilitychange`-Handler, der beim Zurueckkommen sofort nachrechnet und gegebenenfalls beendet.
`performance.now()` bleibt fuer die Reaktionszeitmessung.

**Der Praesentationszeitpunkt wurde als `performance.now()`-Wert geloggt**, also als
Millisekunden seit Seitenaufruf statt als Zeitstempel. In der Datenbank war das wertlos. Jetzt
wird er als Wanduhrzeit gespeichert (`wallStart + (presentedAtPerf - perfStart)`), womit die
Aufloesung von `performance.now()` erhalten bleibt und der Wert trotzdem einen echten Zeitpunkt
bezeichnet.

### Dev-only Dauer-Uebersteuerung

`/play/<slug>?dauer=<sekunden>` kuerzt einen Durchgang, greift aber nur unter `import.meta.dev`.
Ohne das laesst sich ein Sprint weder von Hand noch von Playwright in vertretbarer Zeit bis zum
gespeicherten Ergebnis durchspielen.

### Schriften

Space Grotesk fuer Oberflaeche und Ueberschriften, JetBrains Mono mit Tabellenziffern fuer alle
Zahlen, Timer und Ergebnisse. Beide unter SIL Open Font License, als variable woff2 lokal unter
`public/fonts/`, zusammen rund 62 KB. Kein Google-Fonts-Abruf.

---

## Phase 2, Pruefungskern

### Fuenf Spiele parallel gebaut, danach einzeln adversarisch geprueft

`zahlenreihen`, `wortfluss`, `d2`, `matrizen` und `symbolzahl` entstanden gleichzeitig gegen den
in `docs/GAME-CONTRACT.md` festgeschriebenen Vertrag, jedes in seinem eigenen Ordner. Kein Spiel
darf `app/games/index.ts` oder irgendetwas ausserhalb seines Ordners anfassen; die Registrierung
erfolgt zentral, und `app/games/catalog.test.ts` schlaegt fehl, sobald Ordner und Registrierung
auseinanderlaufen.

Anschliessend wurde jedes Spiel gegen den Vertrag geprueft, mit einer Kontrolle als wichtigstem
Punkt: **testet der Test wirklich etwas, oder wiederholt er nur die Generatorlogik?** Ein Test,
der dieselbe Formel nochmal rechnet, wuerde auch dann gruen bleiben, wenn die Formel falsch ist.
Bei `zahlenreihen` liegt der Beleg in drei unabhaengig im Testfile nachgerechneten
Mehrdeutigkeitspruefungen, bei `matrizen` in der Pruefung, dass die richtige Option jede Regel in
Zeile und Spalte erfuellt und jeder Distraktor sich in genau einem Merkmal unterscheidet.

### Ein `ß` im Wortfluss-Code ist kein Verstoss

Die Schweizer Schreibweise gilt fuer die Texte, die die App **ausgibt**. Die Wortpruefung muss
`ß` dagegen **annehmen**, weil «Straße» eine gueltige Eingabe ist. Der Test haelt beides fest:
die Aufgabenstellung enthaelt kein `ß`, die Eingabepruefung akzeptiert es.

### Radar erst ab drei Konstrukten

Mit einer oder zwei Achsen ist ein Netzdiagramm entartet, es entsteht ein Strich mit einem Punkt.
Darunter zeigt die Statistikseite stattdessen ein kompaktes Notenband pro Konstrukt, was ohnehin
zum Leitmotiv passt.

### Komponenten aus Unterordnern ohne Praefix

Nuxt benennt `components/charts/NoteSparkline.vue` standardmaessig `<ChartsNoteSparkline>`. Die
Diagramme rendern deshalb zuerst gar nicht, ohne Fehlermeldung. Statt die Namen zu verunstalten
steht in `nuxt.config.ts` jetzt `components: [{ path: '~/components', pathPrefix: false }]`.

---

## Phase 3, PWA, Offline und Deployment-Artefakte

### Der schwerwiegendste Fehler des Projekts bisher: DataCloneError

Der End-to-End-Test hat aufgedeckt, was kein Unit-Test finden konnte:

```
DataCloneError: Failed to execute 'put' on 'IDBObjectStore': #<Object> could not be cloned.
```

Das Session-Objekt enthaelt Vue-Proxys, weil Ergebnisse und Kennwerte aus reaktivem State
stammen. **IndexedDB kann Proxys nicht strukturiert klonen.** Die Folge waere gewesen: jedes
Ergebnis scheitert beim Ablegen in die Outbox, und zwar in einem unbehandelten Promise, also
lautlos. Genau der Datenverlust, gegen den die Outbox gebaut ist.

Behoben mit `toPlainPayload`, das vor dem Schreiben durch `JSON.parse(JSON.stringify(...))` geht
und damit exakt das erzeugt, was ohnehin ueber die Leitung geht. Der Regressionstest reproduziert
den Fehler zuerst (`expect(() => structuredClone(reactivePayload)).toThrow()`) und zeigt dann,
dass die bereinigte Fassung klonbar ist.

**Was daraus folgt:** die Unit-Tests pruefen `classifyResponse` isoliert und sehr gruendlich, aber
sie fassen IndexedDB nie an. Die Grenze zwischen reaktivem State und einer Speicher-API ist
genau die Stelle, an der nur ein echter Browserlauf etwas findet.

### Der Startknopf ist bis zum Mounten gesperrt

Playwright klickte «Starten», bevor Nuxt hydriert hatte; der Klick verpuffte, ohne Fehler. Das
ist kein reines Testproblem, sondern passiert auf einem langsamen Geraet auch einem Menschen: man
tippt, nichts geschieht, man tippt nochmal. Der Knopf ist jetzt bis `onMounted` deaktiviert und
beschriftet sich solange mit «Einen Moment».

### Dev-Uebersteuerungen liegen in der Engine, nicht in jeder Play.vue

`?dauer=<sekunden>` und `?items=<anzahl>` kuerzen einen Durchgang und greifen nur unter
`import.meta.dev`. Sie werden in `useEngine` ausgewertet, nicht als Prop durchgereicht. Damit
wirken sie fuer alle 22 Spiele einheitlich, auch fuer die noch nicht gebauten, und der
Spielvertrag bleibt unveraendert. Ohne sie liesse sich ein Sprint weder von Hand noch von
Playwright in vertretbarer Zeit bis zum gespeicherten Ergebnis durchspielen.

### Der Offline-Test prueft den Weg, auf dem Daten verloren gehen koennen

Der erste Entwurf lud die Seite offline und scheiterte am fehlenden Service Worker im
Entwicklungsmodus. Der realistische und wichtigere Fall ist ein anderer: die App ist offen, die
Verbindung bricht **waehrend** des Durchgangs weg. Genau das wird jetzt geprueft, samt der
Bestaetigung, dass waehrend der Funkstille nichts beim Server ankommt und nach der Rueckkehr
automatisch nachgetragen wird, ohne dass man etwas antippen muss.

### Keine Backups, aber ein Exportweg

Auf deinen Wunsch gibt es keinen Backup-Job, keine Rotation, kein Kopieren. `GET /api/export`
bleibt als App-Funktion erhalten und liefert JSON sowie CSV je Tabelle, damit die Daten nie im
Container gefangen sind.

---

## Phase 4, Katalog

### Der Vertrag wird jetzt maschinell durchgesetzt, nicht nur beschrieben

`app/games/contract.test.ts` liest den Quelltext jedes registrierten Spiels und prüft die Regeln
aus `docs/GAME-CONTRACT.md` direkt am Code: keine Kommentare, kein `ß` in einem Text den jemand
liest, keine Gedankenstriche in Zeichenketten, keine Unreinheit im Generator, genau eine
Statusmeldung, eine Repeat-Sperre sobald ein eigener `keydown`-Listener existiert, keine Importe
aus fremden Spielordnern, ein Aufruf des geteilten Generator-Contracts, alle vier Dateien
vorhanden, und keine verwaisten Ordner.

Das war keine Fleissarbeit: **der Test hat sofort einen echten Fehler gefunden.** `d2` hörte auf
`keydown` ohne Repeat-Sperre, gehaltenes Enter hätte also Zeile um Zeile abgeschickt.

Die `ß`-Regel musste dabei präzisiert werden. Sie gilt für **Zeichenketten**, nicht für
Zeichenklassen in regulären Ausdrücken: `wortfluss` muss «Straße» als Eingabe annehmen dürfen.
Die Schweizer Schreibweise gilt für das, was die App ausgibt, nicht für das, was man tippen darf.

### Komponententests laufen jetzt neben den Unit-Tests

Ein Agent hatte für `gonogo` eine eigene Vitest-Konfiguration angelegt, weil das Haus-Setup keinen
Vue-Plugin hatte. Der Umweg war richtig gedacht, aber am falschen Ort. Die Wurzel-Konfiguration
hat jetzt zwei Projekte: `unit` unter Node für alles, und `play` unter happy-dom für Dateien nach
dem Muster `*.play.test.ts`.

Der Nutzen ist konkret. `gonogo/Play.play.test.ts` prüft, was ein Generator-Test nicht erreicht:
dass ohne Tipp von selbst abgeschickt wird, dass ein Tipp ankommt, dass die Leertaste wirkt aber
eine gehaltene Taste ignoriert wird, und dass das Präsentationsfenster zur Schwierigkeitsstufe
passt. Genau diese Schicht, zwischen reaktivem State und Browser-API, hat schon den
`DataCloneError` beherbergt.

### Ein Nutzungslimit hat eine Bauwelle unterbrochen

Von sechs Spielen einer Welle kamen fünf vollständig auf die Platte, eines blieb ein Rumpf und
wurde gelöscht. Keiner der Prüfagenten lief noch. Konsequenz für den Rest: kleinere Wellen, und
die Prüfung übernehme ich mit dem Vertragstest, dem Browserlauf über jedes Spiel und den
Playwright-Tests selbst. Das ist billiger und deckt die mechanischen Verstösse zuverlässiger ab;
was dabei verlorengeht ist das Mutationstesten der Agenten, das im ersten Durchgang die
wertvollsten Funde geliefert hat.

### Stroop trennt Bezeichner und Beschriftung

Intern heisst die Farbe `gruen`, damit `params` ohne Umlaute stabil bleibt und über Jahre
auswertbar ist. Angezeigt wird «grün». Der erste Entwurf zeigte das Bezeichnerwort direkt an, was
bei einem Spiel, dessen ganzer Witz das innere Aussprechen des Wortes ist, besonders stört.

---

## Phase 5, Intelligenz

### Die Schwierigkeit liegt auf dem Server, nicht nur im Browser

Nach jedem Durchgang schreibt `saveSession` die eingependelte Schwierigkeit in `settings`. Die
Spielseite liest sie von dort und fällt auf `localStorage` zurück, wenn der Server nicht
erreichbar ist. Ohne das wandert der Stand nicht zwischen Handy und Laptop.

### Der Tagesplan ist deterministisch pro Tag

Der Plan wird einmal pro Tag berechnet, aus einem Rng der mit dem Datum geseedet ist, und danach
in `plan_days` festgehalten. Ein zweiter Aufruf am selben Tag liefert denselben Plan, sonst würde
sich die Liste unter den Fingern ändern. Die Auswahl selbst ist eine reine Funktion und ohne
Datenbank getestet, unter anderem über einen simulierten Monat der prüft, dass kein Spiel länger
als das Rotationsfenster ausfällt.

### Die Schwachstellenanalyse braucht eine Mindestmenge

Ein Aufgabentyp erscheint erst ab zwölf bearbeiteten Items. Darunter ist die Trefferquote Rauschen
und würde die Liste mit Zufallsbefunden anführen. Sortiert wird nach einem Bedarfswert aus
Trefferquote und mittlerer Reaktionszeit im Verhältnis sieben zu drei, damit Ungenauigkeit
schwerer wiegt als Langsamkeit.

---

## Phase 6, Prüfungssimulation

### Die Promotionsregeln sind vollständig gebaut, obwohl zwei Teile fehlen

`shared/promotion.ts` bildet alle vier ZHAW-Regeln ab, samt doppelter Gewichtung von
Textverständnis, und ist mit einer Grenzfalltabelle geprüft: exakt 4.00, exakt 3.75 vor Rundung,
genau ein Ausreisser auf 3.0, einer auf 2.5, beide Gruppen-A-Teile unter 4.0, zwei
Gruppen-B-Teile unter 4.0. Dazu ein erschöpfender Durchlauf über 4096 Notenkombinationen auf einem
Halbnotenraster, der sicherstellt, dass nie «bestanden» gemeldet wird während eine Regel gerissen
ist.

Die Engine steht damit fertig bereit für den Moment, in dem Sprachliches Denken und
Textverständnis dazukommen. Bis dahin läuft `/exam` als **Standortbestimmung über vier Teile**
und sagt das unmissverständlich: eine Warnung vor dem Start, eine im Ergebnis, und die Nennung
beider fehlender Teile samt Hinweis auf die doppelte Gewichtung.

### Gerundet wird ausdrücklich, nicht nebenbei

Der Durchschnitt wird mit einem eigenen `roundHalfUp` auf zwei Stellen gerundet und dann gegen
4.00 verglichen. Die allgemeine `round`-Hilfsfunktion aus `shared/series.ts` wäre dafür
untauglich, weil sie das Binärverhalten von `Math.round` erbt und bei exakten Hälften mal auf,
mal ab rundet. Bei einer Promotionsentscheidung ist das keine akademische Frage.

### Der Prüfungsseed wird nicht wiederverwendet

Jeder Lauf bekommt einen neuen Seed. Eine Wiederholung mit demselben Seed ist möglich, aber hinter
einem aufgeklappten Abschnitt versteckt, beschriftet mit dem Grund, im Ergebnis vermerkt und in
`exam_runs.repeated_seed` markiert, damit sie aus Verläufen herausgehalten werden kann. Der
Auftrag hatte die Wiederverwendung als Mittel für Vergleichbarkeit vorgesehen; sie misst beim
zweiten Mal aber Gedächtnis statt Können, und zwar genau bei dem Durchgang dessen Aussagekraft am
wichtigsten ist.

### Ein abgebrochener Lauf geht nicht verloren

Nach jedem Teil wird der Zwischenstand in `localStorage` festgehalten. Wer die App schliesst oder
das Handy neu startet, bekommt beim nächsten Öffnen von `/exam` das Angebot fortzusetzen, mit
Angabe des erreichten Teils. Bei einem Durchgang, der in der Vollausbaustufe zweieinhalb Stunden
dauert, ist das kein Komfort, sondern Voraussetzung.

### Die Prüfungsnoten kommen aus den Startschwellen

Nicht aus der persönlichen Normierung. Ein Prüfungslauf soll über Monate mit sich selbst
vergleichbar sein, und eine mitwandernde Bezugsverteilung würde genau das zerstören. In der
Oberfläche steht das unter dem Notenband.
