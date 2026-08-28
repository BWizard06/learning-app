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
