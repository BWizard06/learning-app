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
