# Implementierungsplan «learning-app»

Kognitive Trainings-App als PWA, betrieben als Docker-Service auf dem VPS `kumo`.
Stand: 2026-08-27. Dieser Plan ist die Grundlage fuer die Umsetzung und wartet auf dein OK.

---

## 1. Zielbild

Eine Progressive Web App fuer taegliches kognitives Training, benutzt von einer einzelnen
Person. Ursprung ist die Vorbereitung auf die schriftliche Faehigkeitspruefung des
Bachelorstudiengangs Angewandte Psychologie an der ZHAW; danach laeuft sie als dauerhaftes
Gehirntraining weiter.

Code enthaelt **keine Kommentare**. Namen und Struktur tragen die Erklaerung.

Oberflaeche und Inhalte durchgehend **Deutsch, Schweizer Rechtschreibung** (kein ss-Ersatzzeichen,
immer ss; keine Gedankenstriche in Fliesstexten der Oberflaeche). Code, Kommentare,
Variablennamen und Commit-Messages **Englisch**.

Leitmotiv ist das **Notenband**: jedes Ergebnis wird auf eine Skala von 1 bis 6 abgebildet, mit
sichtbarer Bestehensgrenze bei 4.0.

---

## 2. Getroffene Entscheidungen

| Thema | Entscheidung | Begruendung |
|---|---|---|
| Name | `learning-app`, Subdomain `learning.braendle.tech`, Repo `BWizard06/learning-app`, Serverpfad `/opt/kumo/services/apps/learning-app/` | Neutral beschreibend statt an ein Motiv gebunden; passt zur Ein-Wort-Konvention der uebrigen kumo-Services |
| Auth | **Nur Authelia**, Fall A aus dem Runbook. Kein eigener Login-Code, keine Passphrase, keine Benutzertabelle | Ein Login, kein zweiter Auth-Pfad, kein selbstgebautes Rate Limit |
| Authelia-Konfiguration | **Wird nicht angefasst.** Defaults bleiben (1 h Sitzung, 5 min Inaktivitaet) | Kein Eingriff in einen laufenden Dienst, den vier andere Services teilen. Die App faengt abgelaufene Sitzungen selbst sauber ab (siehe 6.3) |
| Datenbank | SQLite ueber **`node:sqlite`** mit `drizzle-orm/node-sqlite`, **Node 24 LTS** | Abweichung vom Auftrag, siehe 3.1 |
| Deployment | Docker-Image wird **auf kumo gebaut** (`docker compose build`), Quelle per `git clone` aus dem privaten GitHub-Repo | Ein Container wie alle anderen, vollstaendig unabhaengig vom Mac, nahtlos in Beszel, Dozzle und Uptime Kuma |
| Inhalte | **Keine kuratierten Inhaltsdateien.** Nur Spiele, deren Items sich deterministisch erzeugen lassen | Bewusste Entscheidung, siehe 3.2 und 7 |
| Backups | **Keine.** Kein VACUUM-INTO-Job, keine Rotation, kein Off-Box-Kopieren | Bewusste Entscheidung. `GET /api/export` bleibt als App-Funktion erhalten, damit du jederzeit selbst exportieren kannst |
| Notenlogik | Der Rohwert enthaelt die **Schwierigkeit**, nicht nur Trefferquote und Tempo | Behebt einen Widerspruch im Auftrag, siehe 3.3 |
| Design | Prototyp `reference/prototype.html` existiert nicht mehr. Designsprache wird aus der Beschreibung im Auftrag neu aufgebaut | Ein Design-Screen in Phase 1 geht zur Abnahme an dich, bevor weitergebaut wird |
| Reihenfolge | Phasenfolge aus dem Auftrag, angepasst an den reduzierten Katalog | Kein Pruefungstermin genannt |

---

## 3. Wo ich vom Auftrag abweiche

Der Auftrag verlangt ausdruecklich, alle Stellen zu nennen, an denen ich nicht einverstanden bin
oder eine bessere Loesung sehe. Hier sind sie, absteigend nach Tragweite.

### 3.1 `better-sqlite3` → `node:sqlite` und Node 22 → Node 24 (entschieden)

`better-sqlite3` ist ein nativ kompiliertes Modul. Es zwingt jeden Build-Weg in eine
linux/amd64-Umgebung und macht das Image von einer Build-Toolchain abhaengig, die bei jedem
Node-Upgrade neu greifen muss.

Node bringt seit 22.5 ein eigenes SQLite mit (`node:sqlite`, `DatabaseSync`), und Drizzle hat
dafuer einen offiziellen Treiber `drizzle-orm/node-sqlite`. Damit gibt es **null native Module**:
das Image braucht keinen Compiler, der Build auf kumo wird deutlich leichter, und ein
Node-Upgrade erzwingt kein Rebuild nativer Bindings. WAL-Modus und `VACUUM INTO` funktionieren
ueber `exec()` genauso.

Node 24 statt 22, weil `node:sqlite` dort ohne Flag und als stabil gilt. 24 ist ebenfalls LTS,
also eine Bewegung nach vorn, keine zur Seite. Drizzle und Drizzle Kit bleiben wie beauftragt.

**Risiko:** `node:sqlite` ist juenger und weniger erprobt als `better-sqlite3`. Der Umstieg ist
aber billig, weil Drizzle die Abstraktion ist; ein Wechsel zurueck betrifft eine Datei.

### 3.2 Kein Textverstaendnis, kein Sprachliches Denken (entschieden, mit Vorbehalt dokumentiert)

Auf deinen ausdruecklichen Wunsch entfallen alle Spiele, die kuratierte Inhalte brauchen. Die
Konsequenz gehoert hier festgehalten, damit sie spaeter nicht ueberrascht:

- Der Pruefungsteil **Sprachliches Denken** ist vollstaendig unbesetzt.
- Der Pruefungsteil **Textverstaendnis** ist vollstaendig unbesetzt. Das ist in der
  ZHAW-Wertung der **doppelt gewichtete** Teil.
- Die **Pruefungssimulation** aus Phase 6 laesst sich in der beauftragten Form nicht bauen, weil
  die Promotionsregeln alle sechs Teile brauchen. Vorschlag dazu unter 10, Phase 6.
- Das **Radar** verliert zwei Pruefungsachsen und zeigt vier Pruefungskonstrukte plus
  Gedaechtnis als fuenfte Achse statt der sechs aus dem Auftrag.

Die App ist damit ein vollwertiges Gehirntraining und deckt vier der sechs Pruefungskonstrukte ab
(Rechnerisches Denken, Logisches Denken, Wortfluessigkeit, Konzentrationsleistung), plus
Gedaechtnis als fuenftes, nicht pruefungsrelevantes Konstrukt.

**Der billigste Weg zurueck**, falls du es dir anders ueberlegst: eine einzige frei lizenzierte
deutsche Wortliste im Repo schaltet `anagramme` und die Plausibilitaetspruefung bei `wortfluss`
frei. Alles andere braucht geschriebene Items. Die Architektur haelt beide Tueren offen: die
Spieldefinitionen sind eine Registry, ein neues Spiel ist ein Ordner, keine Aenderung am Kern.

### 3.3 Der Rohwert muss die Schwierigkeit enthalten (entschieden)

Im Auftrag steht: Staircase auf rund 75 Prozent Trefferquote, und die Schwierigkeit wird in der
Session **mitgeschrieben**, damit Trends nicht durch Niveauwechsel verfaelscht werden.

Mitschreiben reicht nicht. Wenn die Staircase die Trefferquote per Konstruktion bei 75 Prozent
haelt und der Rohwert im Wesentlichen aus Trefferquote und Tempo besteht, ist die Note ueber
Monate konstant. Du wirst besser, spielst schwerere Items, und die Note bewegt sich nicht.

Deshalb: `RawScore` ist ein **schwierigkeitsgewichteter Durchsatz**. Grundform

```
rawScore = summe(weight(difficulty_i) fuer korrekt geloeste Items) / dauerMinuten
```

`weight(d)` ist pro Spiel definiert, monoton steigend ueber `difficultyRange`, dokumentiert in
`docs/GAMES.md`. Bei Spannenverfahren (`span`) ist die erreichte Spannenlaenge selbst der
Rohwert, dort greift die Gewichtung nicht.

Falsche Antworten zaehlen nicht negativ, aber sie kosten Zeit und druecken damit den Durchsatz.
Das ist die richtige Anreizrichtung: Raten wird nicht bestraft, aber es lohnt sich auch nicht.

### 3.4 Der Pruefungsseed darf nicht wiederverwendet werden (Vorschlag)

Im Auftrag steht, der Pruefungsmodus koenne fuer Vergleichbarkeit denselben Seed ueber mehrere
Anlaeufe verwenden. Das misst beim zweiten Durchgang Gedaechtnis, nicht Faehigkeit, und zwar
genau bei dem Durchgang, dessen Aussagekraft am wichtigsten ist.

**Vorschlag:** jeder Lauf bekommt einen neuen Seed. Der Seed wird gespeichert, damit ein Lauf
reproduzierbar und debugbar bleibt. Eine ausdrueckliche Option «Wiederholung mit gleichem Seed»
bleibt vorhanden, sichtbar beschriftet, und ein so erzeugtes Ergebnis wird in der Statistik
markiert und aus Verlaeufen ausgeschlossen.

### 3.5 Property-Tests: 1'000 statt 10'000 im Normalfall (Vorschlag)

10'000 Durchlaeufe pro Generator ueber 22 Generatoren machen den Test-Lauf so langsam, dass er
beim Entwickeln nicht mehr laeuft, und ein Test, der nicht laeuft, findet nichts.

**Vorschlag:** `npm test` faehrt 1'000 Durchlaeufe pro Generator, `npm run test:full` faehrt
10'000. Die Anzahl kommt aus einer Umgebungsvariable, die Testdatei ist identisch. Vor jedem
Phasenabschluss laeuft `test:full`, und nur dessen Ausgabe zaehlt als Beleg.

### 3.6 `day_log` ist abgeleitet, nicht Quelle (Vorschlag)

`day_log` enthaelt ausschliesslich Werte, die sich aus `sessions` und `trials` berechnen lassen.
Als zweite Wahrheit wuerde es frueher oder spaeter auseinanderlaufen.

**Vorschlag:** `day_log` bleibt als Tabelle bestehen (schnelle Statistik, Streak-Berechnung),
wird aber ausschliesslich beim Schreiben einer Session neu berechnet, nie von Hand gepflegt, und
ein `POST /api/maintenance/rebuild-daylog` baut sie jederzeit vollstaendig aus den Rohdaten neu
auf. Damit ist sie ein Cache, kein Original.

### 3.7 `analogien` und `wortanalogien` sind dasselbe Spiel (Hinweis)

Der Auftrag listet beide, und beschreibt `wortanalogien` als «siehe `analogien`, hier
ausschliesslich verbal». Da beide inhaltsabhaengigen Varianten ohnehin entfallen, ist das
aktuell gegenstandslos. Falls die Sprachspiele spaeter dazukommen: ein Spiel mit einem
Modusschalter, nicht zwei Ordner.

---

## 4. Technischer Rahmen

| Baustein | Wahl |
|---|---|
| Framework | Nuxt 4, TypeScript, `<script setup>`, Composition API |
| Server | Nitro Server Routes unter `server/api/` |
| Datenbank | SQLite via `node:sqlite`, Zugriff ausschliesslich ueber Drizzle ORM |
| Migrationen | Drizzle Kit, versioniert unter `server/db/migrations/`, beim Containerstart angewendet |
| Client-State | Pinia (`@pinia/nuxt`) |
| PWA | `@vite-pwa/nuxt` |
| Styling | Tailwind CSS 4 ueber das `@tailwindcss/vite`-Plugin, eigener Token-Layer, keine UI-Kits |
| Tests | Vitest (Unit + Property), Playwright (E2E) |
| Runtime | Node 24 LTS |
| Container | Multi-Stage-Dockerfile, `node:24-slim` als Runtime, non-root |

Waehrend eines Durchgangs gibt es **keine Netzwerkaufrufe**. Keine KI-API, keine Analytics, keine
Drittanbieter. Die App funktioniert vollstaendig offline und synchronisiert danach.

Schriften werden **lokal** ausgeliefert, nicht von Google Fonts. Vorschlag, zur Abnahme mit dem
Design-Screen in Phase 1: **Space Grotesk** fuer Oberflaeche und Ueberschriften, **JetBrains
Mono** fuer alle Zahlen, Timer und Ergebnisse (Tabellenziffern). Beide unter SIL Open Font
License, als woff2 unter `public/fonts/`, eingebunden per `@font-face` mit `font-display: swap`.

---

## 5. Verzeichnisstruktur

```
app/
  components/       Notenband, Timer, Ziffernblock, TrialFrame, AppHeader, ScoreBand, ...
  composables/      useEngine, useTrialLogger, useOfflineQueue, useAdaptive, useSession
  games/            ein Ordner pro Spiel: definition.ts, generator.ts, Play.vue, generator.test.ts
  pages/            index, play/[slug], stats, plan, settings   (exam ab Phase 6)
  stores/           session, catalog, sync
  assets/css/       tokens.css, base.css
server/
  api/              sessions, trials, stats, plan, settings, export, health
  db/               schema.ts, migrations/, client.ts, seed.ts
  services/         scoring.ts, adaptive.ts, streak.ts, plan.ts, promotion.ts
shared/
  types/            gemeinsame Typen zwischen Client und Server
  rng.ts            deterministischer PRNG (mulberry32)
docs/               PLAN.md, DECISIONS.md, GAMES.md, DEPLOY.md
public/fonts/       woff2
deploy/             compose.yaml, .env.example
Dockerfile
```

`app/` als `srcDir` und `shared/` als geteiltes Verzeichnis entsprechen den Nuxt-4-Konventionen.

---

## 6. Architektur

### 6.1 Spiel-Engine

Alle Spiele laufen ueber eine gemeinsame Engine, damit Timing, Logging und Auswertung ueberall
identisch sind.

```ts
interface GameDefinition {
  slug: string
  name: string
  construct: Construct        // 'rechnen' | 'logik' | 'wortfluss' | 'konzentration' | 'gedaechtnis'
  blurb: string
  mode: 'sprint' | 'block' | 'span' | 'reading'
  defaultDurationS: number
  difficultyRange: [number, number]
  weight(difficulty: number): number      // NEU, siehe 3.3
  generate(difficulty: number, rng: Rng): Trial | TrialBlock
  score(trials: TrialResult[], durationS: number): RawScore   // nutzt weight(), siehe 3.3
}
```

`reading` bleibt im Typ, wird aber von keinem Spiel benutzt, weil beide Lesespiele
zurueckgestellt sind. So kommen sie spaeter ohne Bruch dazu.

Der Zufallsgenerator ist **seedbar** (`mulberry32`). Der Seed wird pro Session gespeichert, damit
Durchgaenge reproduzierbar und testbar sind.

**Zeitmessung** bei `stroop`, `gonogo` und `nback`: `performance.now()` fuer die Messung,
`requestAnimationFrame` fuer die Reizpraesentation, nie `setTimeout`. Der tatsaechliche
Praesentationszeitpunkt wird mitgeloggt. Zielgenauigkeit unter 20 Millisekunden.

### 6.2 Datenmodell

```
games          id, slug, name, construct, active, sort_order
sessions       id (uuidv7), game_slug, started_at, finished_at, duration_ms, difficulty,
               raw_score, accuracy, note, seed, mode, device_id, synced_at
trials         id, session_id, idx, item_type, item_json, response_json,
               correct, rt_ms, presented_at
day_log        date, sessions_count, minutes, mean_note, constructs_json      (abgeleitet, 3.6)
settings       key, value
plan_days      date, prescribed_json, completed_json
exam_runs      id, started_at, finished_at, part_notes_json, passed, verdict_json
```

`trials` wird **immer** geschrieben, fuer jedes einzelne Item. Genau daraus entsteht die
Schwachstellenanalyse auf Aufgabentyp-Ebene. `item_json` enthaelt Aufgabentyp und Parameter,
nicht den gerenderten Text.

Indizes auf `sessions(game_slug, started_at)`, `trials(session_id)`, `trials(item_type)`,
`day_log(date)`.

Zeitstempel werden als **UTC-Epoch in Millisekunden** gespeichert. Tagesgrenzen, Streak und die
Tageszeitanalyse rechnen in **Europe/Zurich**; der Container laeuft mit `TZ=Europe/Zurich`.

### 6.3 Offline, Synchronisation und die Authelia-Sitzung

Da Authelia unveraendert bleibt, laeuft die Sitzung nach einer Stunde ab. Der Sync muss das
sauber verkraften, sonst verschwinden Ergebnisse still. Regeln:

1. Ein Ergebnis wird **zuerst** in eine IndexedDB-Outbox geschrieben, dann an `POST /api/sessions`
   gesendet.
2. Ein Outbox-Eintrag wird **nur dann** entfernt, wenn die Antwort Status 2xx hat **und**
   `content-type: application/json` ist **und** der Body die erwartete Form hat. Ein 302 auf das
   Authelia-Portal, eine HTML-Antwort oder ein 401 bedeuten: Eintrag bleibt liegen.
3. In diesem Fall setzt der Sync-Store `sessionExpired` und die Oberflaeche zeigt ein Banner
   «Sitzung abgelaufen. Zum Anmelden tippen.» Der Tipp loest einen vollen Seitenwechsel aus, der
   die Authelia-Weiterleitung normal durchlaeuft.
4. Nach erfolgreichem Login wird die Outbox automatisch abgearbeitet.
5. Jede Session traegt clientseitig eine **UUIDv7** als Primaerschluessel, der Server nutzt
   `INSERT OR IGNORE` auf der ID. Doppeltes Senden ist damit idempotent, und ein Retry nach
   unklarem Ausgang ist gefahrlos.
6. Ein `device_id` in `localStorage`, damit spaeter erkennbar ist, woher ein Durchgang kam.
7. Der Service Worker precached die App-Shell. **API-Aufrufe werden nie gecached.**

Wichtig fuer die Praxis: die App startet dank Precache auch mit abgelaufener Sitzung sofort, ein
kompletter Durchgang ist offline moeglich, und erst der Sync merkt, dass ein Login faellig ist.
Es geht dabei nichts verloren.

### 6.4 Auth

Fall A aus dem Runbook. Kein eigener Login-Code, keine Benutzertabelle, kein Rate Limit noetig,
weil Authelia die einzige Tuer ist.

Zwei Dinge sind dafuer zwingend, beides in Phase 3:

- Traefik-Label `traefik.http.routers.learning-app.middlewares=authelia@docker`
- Eine Regel in `access_control` der Authelia-Konfiguration fuer `learning.braendle.tech` mit
  `policy: one_factor` und `subject: group:lldap_admin`. Ohne diese Regel liefert die Domain
  wegen `default_policy: deny` einen harten 403, ohne Login. Das ist laut Runbook der haeufigste
  Fehler.

Der Uptime-Kuma-Monitor prueft **intern** ueber `http://learning-app:3000/api/health` und
umgeht damit Traefik und Authelia komplett; ein 401-Problem wie bei Dozzle kann hier nicht
entstehen.

---

## 7. Spielkatalog

22 Spiele, alle Items deterministisch erzeugt, alle Generatoren seedbar und property-getestet.

### Rechnerisches Denken (5)

| Slug | Spiel | Format |
|---|---|---|
| `kopfrechnen` | Kopfrechnen-Sprint | Prozentwert, Prozentsatz, Grundwert, Brueche, Multiplikation, Division, Dreisatz, Zuschlag und Rabatt, Weg-Zeit-Geschwindigkeit, Mischungsrechnen. Freie Zahleneingabe ueber eigenen Ziffernblock, ganzzahlige Loesungen |
| `ueberschlag` | Ueberschlag | Eine Rechnung, fuenf Ergebnisvorschlaege, einer korrekt. Groessenordnung statt exakter Rechnung, hoher Zeitdruck |
| `rechenzeichen` | Rechenzeichen einsetzen | `6 _ 3 _ 2 = 20`, Operatoren aus `+ - x :`, Punkt vor Strich |
| `einheiten` | Umrechnen | Laengen, Flaechen, Volumen, Zeit, Geschwindigkeit, Massstab, Prozent in Bruch und zurueck |
| `datenlesen` | Tabellen und Diagramme | Generiertes Balken-, Linien- oder Kreisdiagramm als inline SVG plus Frage nach Differenz, Anteil, Trend oder Extremwert |

### Logisches Denken (5)

| Slug | Spiel | Format |
|---|---|---|
| `zahlenreihen` | Zahlenreihen | Mindestens zehn Bildungsgesetze: konstante Differenz, konstanter Faktor, alternierende Schritte, zweite Differenz, verschachtelte Reihen, Fibonacci-artig, Quadratzahlen mit Versatz, Wechsel aus Multiplikation und Addition, Differenzen als eigene Reihe, Primzahlversatz. Freie Eingabe |
| `figurenreihen` | Figurenreihen | Generierte SVG-Sequenz mit Transformationsregeln: Rotation, Spiegelung, Elementzahl, Fuellung, Position. Sechs Antwortoptionen |
| `matrizen` | Matrizen | 3x3-Raster nach Raven-Prinzip, eine Zelle fehlt, Regeln zeilen- und spaltenweise kombiniert |
| `syllogismen` | Schlussfolgerungen | Zwei Praemissen, eine Konklusion. Antwort: folgt zwingend, folgt nicht, widerspricht. Generiert ueber Quantorenschemata mit einem kleinen generischen Begriffspool, nicht handgeschrieben |
| `wuerfel` | Wuerfel und Rotation | Gefaltete Wuerfelnetze und mentale Rotation, inline SVG mit isometrischer Projektion |

### Wortfluessigkeit (1)

| Slug | Spiel | Format |
|---|---|---|
| `wortfluss` | Wortfluessigkeit | Anfangsbuchstabe, Kategorie, oder kombiniert. Automatische Zaehlung mit Duplikatentfernung, Mindestlaenge und Pruefung des Anfangsbuchstabens. Ohne Wortliste, also keine Plausibilitaetspruefung gegen ein Lexikon |

### Konzentrationsleistung (6)

| Slug | Spiel | Format |
|---|---|---|
| `d2` | Durchstreichtest | d2-Aufbau, Zeichen d und p mit ein bis vier Strichen, Ziel ist d mit genau zwei Strichen, Zielquote rund 45 Prozent. Zeilenweise Bearbeitung. Kennwerte: Treffer, Auslassungen, Verwechslungen, Bearbeitungsmenge, Fehlerprozent, Schwankungsbreite ueber die Zeilen |
| `symbolzahl` | Zahlen-Symbol | Legende ordnet neun Symbole neun Ziffern zu, moeglichst viele Zuordnungen in fester Zeit |
| `stroop` | Stroop | Farbwort in abweichender Schriftfarbe, benannt wird die Farbe. Kongruente und inkongruente Durchgaenge getrennt ausgewertet, Interferenzeffekt in Millisekunden |
| `zeichenvergleich` | Zeichenvergleich | Zwei Zeichenketten, identisch oder nicht. Unterschiede minimal: vertauschte Ziffern, aehnliche Glyphen |
| `gonogo` | Go und No-Go | Dauerhafte Reizfolge, Reaktion auf Go, Unterdrueckung bei No-Go. Kommissionsfehler, Omissionsfehler, Reaktionszeitvariabilitaet |
| `trailmaking` | Zahlenpfad | Teil A nur Zahlen, Teil B abwechselnd Zahl und Buchstabe. Zeit bis Abschluss, Fehler werden korrigiert und gezaehlt |

### Gedaechtnis (5)

| Slug | Spiel | Format |
|---|---|---|
| `nback` | N-Back | Visuell (Position im Raster), verbal (Buchstabe), dual. n von 1 bis 4, adaptiv |
| `zahlenspanne` | Zahlenspanne | Vorwaerts und rueckwaerts, Spannenverfahren, Abbruch nach zwei Fehlern gleicher Laenge |
| `corsi` | Corsi-Bloecke | Raeumliche Spanne, Sequenz aufleuchtender Felder nachtippen, vorwaerts und rueckwaerts |
| `figurenlernen` | Figuren lernen | Einpraegephase mit generierten SVG-Ausschnitten, Distraktoraufgabe, danach Wiedererkennen |
| `faktenlernen` | Fakten lernen | Sechs bis acht Kurzprofile aus kombinatorisch erzeugten Merkmalen einpraegen, Distraktorphase, gezielte Abfrage |

### Zurueckgestellt

Diese neun brauchen kuratierte Inhalte und sind auf deinen Wunsch nicht Teil des Katalogs:
`wortanalogien`, `analogien`, `oberbegriffe`, `satzergaenzung`, `fremdwoerter`, `anagramme`,
`paare`, `textverstaendnis`, `schnelllesen`.

`anagramme` und `paare` brauchen dabei nur eine frei lizenzierte deutsche Wortliste, keine
geschriebenen Items; sie waeren der billigste Nachschlag.

### Distraktoren

Wo Multiple Choice vorkommt gilt durchgehend: genau eine Antwort ist eindeutig richtig, alle
Distraktoren sind plausibel und ergeben sich aus typischen Fehlern (Vorzeichenfehler,
Zehnerfehler, Umkehrung der Operation), nie aus Zufallszahlen. Das wird property-getestet.

### Keine Nachbildung geschuetzter Testverfahren

`d2`, `stroop`, `corsi` und N-Back sind in der Fachliteratur beschriebene Paradigmen. Gebaut
werden die Paradigmen, nicht die kommerziellen Testkits: keine Originalmaterialien, keine
Normtabellen, keine Testboegen.

---

## 8. Bewertung, Adaptivitaet und Auswertung

### 8.1 Notenband

Jedes Ergebnis wird auf 1 bis 6 abgebildet, Bestehensgrenze 4.0 sichtbar. Zweistufig:

1. **Startschwellen**: pro Spiel hinterlegte Rohwert-Schwellen als Ausgangspunkt.
2. **Persoenliche Normierung**: ab zwanzig Sessions pro Spiel kommt die Note aus dem z-Wert
   gegenueber der eigenen Verteilung der letzten neunzig Tage, mit fixem Anker: der Median der
   ersten zehn Sessions entspricht 4.0.

Die Oberflaeche zeigt immer an, welche der beiden Quellen gilt.

**Die Note ist ein eigener Richtwert und wird nirgends als Vorhersage des tatsaechlichen
ZHAW-Ergebnisses dargestellt.** Ein entsprechender Hinweis steht sichtbar in der
Statistikansicht. Solange zwei Pruefungskonstrukte fehlen, steht dort zusaetzlich, welche.

### 8.2 Adaptive Schwierigkeit

Pro Spiel ein Schwierigkeitswert, Staircase mit Zielwert um 75 Prozent Trefferquote: zwei
richtige Antworten in Folge erhoehen, eine falsche senkt. Bei Spannenverfahren ist die
Spannenlaenge selbst die Schwierigkeit.

Der Wert wird in `settings` persistiert und in jeder Session mitgeschrieben. Er geht zusaetzlich
in den Rohwert ein (3.3).

### 8.3 Auswertungen

Die Statistikseite liefert mindestens:

- Verlauf der Note pro Konstrukt ueber Zeit, mit gleitendem Mittel
- Radardarstellung mit der 4.0-Linie als Referenzring: die vier abgedeckten Pruefungskonstrukte
  plus Gedaechtnis als fuenfte Achse, die fehlenden zwei Pruefungsteile ausdruecklich benannt
- Schwachstellenanalyse auf Aufgabentyp-Ebene: Trefferquote und mittlere Reaktionszeit je
  `item_type`, absteigend nach Handlungsbedarf
- Reaktionszeitverteilung und deren Streuung, weil Konstanz hier mehr zaehlt als Spitzenwerte
- Tageszeitanalyse: Leistung nach Uhrzeit, relevant weil die echte Pruefung um 17:30 beginnt
- Streak, Trainingsminuten pro Woche, Sessions pro Konstrukt

Diagramme direkt als SVG, keine Charting-Suite.

### 8.4 Tagesplan

`server/services/plan.ts` erzeugt pro Tag eine Empfehlung von vier bis sechs Spielen, etwa zwoelf
bis fuenfzehn Minuten. Regeln:

- Konstrukte mit der schwaechsten Note bekommen mehr Slots
- Konzentrationsspiele hoechstens zwei pro Tag (starke Ermuedung, schnelle Saettigung des
  Uebungseffekts)
- Kein Spiel zweimal am selben Tag im Plan
- Rotation ueber den ganzen Katalog, kein Spiel faellt laenger als zehn Tage aus

Die Regel «Textverstaendnis mindestens jeden zweiten Tag» entfaellt mangels Spiel und kommt
zurueck, sobald es existiert.

Der Plan ist ein Vorschlag, kein Zwang. Freie Auswahl aller Spiele bleibt jederzeit moeglich.

---

## 9. Gestaltung

Palette, Typografie und Notenband-Motiv werden aus der Beschreibung im Auftrag aufgebaut, weil
der Prototyp nicht mehr existiert, und als Token-System in `app/assets/css/tokens.css` abgelegt.

- Papier-Hintergrund, tiefe Tinte als Textfarbe, Ultramarin als einziger Akzent, Gold nur fuer
  Streak und Rekorde, Gruen und Rot ausschliesslich fuer bestanden und nicht bestanden
- Helle und dunkle Variante ueber `prefers-color-scheme`, zusaetzlich manuell umstellbar
- Geometrische Grotesk fuer Oberflaeche, Mono mit Tabellenziffern fuer alle Zahlen, Timer und
  Ergebnisse
- Sentence case ueberall, Grossbuchstaben nur als Eyebrow-Label
- Mobile first, Zielbreite 390 px, maximale Inhaltsbreite 560 px

Nicht verhandelbare Qualitaetsschwelle, gilt als Akzeptanzkriterium jeder Phase:

- Alle Eingaben waehrend eines Durchgangs einhaendig mit dem Daumen erreichbar
- Eigener Ziffernblock statt Systemtastatur bei allen Zahleneingaben, damit das Layout nicht springt
- Kopfzeile mit Uhr und Fortschrittsbalken bleibt beim Scrollen sichtbar
- `prefers-reduced-motion` wird respektiert
- Sichtbarer Tastaturfokus, vollstaendige Tastaturbedienung am Desktop
- Kein Zoom-Sprung beim Antippen von Eingabefeldern, Schriftgroesse mindestens 16 px
- Farbe ist nie der einzige Bedeutungstraeger

---

## 10. Phasen

Jede Phase endet mit einem lauffaehigen Zustand, gruenen Tests (`test:full`) und einem Commit,
plus einem Eintrag in `docs/DECISIONS.md`. Vertikale Schnitte: ein Spiel wird komplett fertig,
also Generator, Tests, UI, Persistenz, Auswertung, bevor das naechste beginnt.

### Phase 1: Fundament

**Dateien**

- `nuxt.config.ts`, `tsconfig.json`, `package.json`, `.gitignore`, `vitest.config.ts`
- `app/assets/css/tokens.css`, `app/assets/css/base.css`, `public/fonts/*.woff2`
- `shared/rng.ts`, `shared/types/*.ts`
- `server/db/schema.ts`, `server/db/client.ts`, `server/db/migrations/0000_*.sql`, `drizzle.config.ts`
- `server/api/sessions.post.ts`, `server/api/sessions.get.ts`, `server/api/health.get.ts`
- `server/services/scoring.ts`
- `app/composables/useEngine.ts`, `useTrialLogger.ts`
- `app/components/ScoreBand.vue`, `Timer.vue`, `NumberPad.vue`, `TrialFrame.vue`, `AppHeader.vue`
- `app/pages/index.vue`, `app/pages/play/[slug].vue`
- `app/games/kopfrechnen/{definition.ts,generator.ts,Play.vue,generator.test.ts}`
- `docs/DECISIONS.md`, `docs/GAMES.md`

**Akzeptanzkriterien**

- [ ] `npm run dev` startet, `/` zeigt den Katalog mit einem Spiel
- [ ] Ein vollstaendiger `kopfrechnen`-Durchgang laeuft, Ergebnis landet in SQLite, `trials` enthaelt jedes Item einzeln
- [ ] Property-Test ueber 10'000 Durchlaeufe: genau eine korrekte Antwort, Loesung ganzzahlig und im Wertebereich, keine Ausreisser ueber der Obergrenze
- [ ] Gleicher Seed erzeugt nachweislich dieselbe Item-Folge
- [ ] Notenband rendert mit sichtbarer 4.0-Linie, Note kommt aus den Startschwellen und ist als solche gekennzeichnet
- [ ] Ziffernblock loest keine Systemtastatur aus, Layout springt nicht
- [ ] **Design-Screen geht an dich zur Abnahme**, bevor Phase 2 beginnt
- [ ] `npm run test:full` gruen, Ausgabe im Commit belegt

### Phase 2: Pruefungskern

Die vier verbliebenen Pruefungskonstrukte werden abgedeckt, damit die App produktiv nutzbar ist.

**Spiele:** `zahlenreihen` (Logik), `wortfluss` (Wortfluessigkeit), `d2` (Konzentration),
`matrizen` (Logik), `symbolzahl` (Konzentration).

`textverstaendnis` und `wortanalogien` aus dem urspruenglichen Phase-2-Zuschnitt entfallen und
sind durch `matrizen` und `symbolzahl` ersetzt.

**Dateien:** je ein Ordner unter `app/games/`, dazu `server/api/stats.get.ts`,
`app/pages/stats.vue`, `app/components/charts/*.vue`, `server/services/streak.ts`

**Akzeptanzkriterien**

- [ ] Alle fuenf Spiele vollstaendig spielbar, mit Persistenz und Auswertung
- [ ] Property-Tests je Generator gruen ueber 10'000 Durchlaeufe
- [ ] `d2` weist Treffer, Auslassungen, Verwechslungen, Bearbeitungsmenge, Fehlerprozent und Schwankungsbreite aus
- [ ] Statistikseite zeigt Notenverlauf, Radar mit 4.0-Ring und Streak
- [ ] Hinweis sichtbar, dass die Note kein ZHAW-Ergebnis vorhersagt und welche zwei Konstrukte fehlen
- [ ] `npm run test:full` gruen

### Phase 3: PWA, Offline und Deployment-Artefakte (Zwischenstopp)

**Abgrenzung:** In dieser Phase entstehen alle Artefakte, die fuer den Betrieb auf kumo noetig
sind. **Ausgefuehrt wird auf kumo nichts.** Kein SSH, kein Build, keine Aenderung an Authelia,
keine Swap-Datei, kein Cloudflare-Record. Die Inbetriebnahme machen wir spaeter gemeinsam Schritt
fuer Schritt anhand von `docs/DEPLOY.md`.

**Dateien**

- `nuxt.config.ts` (PWA-Block), `public/manifest.webmanifest`, Icons
- `app/composables/useOfflineQueue.ts`, `app/stores/sync.ts`, `app/components/SyncBanner.vue`
- `Dockerfile`, `deploy/compose.yaml`, `deploy/.env.example`, `docs/DEPLOY.md`
- Playwright: `e2e/offline-sync.spec.ts`, `e2e/games/*.spec.ts`

**Was `docs/DEPLOY.md` enthaelt** (als Anleitung fuer dich, nicht als ausgefuehrte Schritte)

1. Cloudflare A-Record `learning` auf kumos IP, proxied (orange)
2. `mkdir -p /opt/kumo/services/apps/learning-app`
3. Deploy Key auf kumo erzeugen, oeffentlichen Teil als Read-only Deploy Key im GitHub-Repo hinterlegen, Repo klonen
4. `compose.yaml` mit `build: .`, `image: learning-app:<version>`, `container_name: learning-app`, `restart: unless-stopped`, `TZ=Europe/Zurich`, Volume `./data:/data`, `user: "1001:1001"`, Netzwerk `proxy`, Healthcheck, Traefik-Labels inklusive `middlewares=authelia@docker`. **Kein `ports:`-Block**
   *(`1001:1001` weil `ben` auf kumo uid 1001 hat, der Standarduser im Node-Image aber 1000. Genau die Falle, die bei LLDAP zugeschlagen hat: Container-UID muss zum Besitzer der gemounteten Dateien passen, sonst Permission denied auf `./data`.)*
5. Authelia `access_control`-Regel fuer `learning.braendle.tech` ergaenzen, Authelia neu starten.
   **Ohne diese Regel liefert die Domain wegen `default_policy: deny` einen harten 403, ohne Login.**
6. Speicher pruefen, gegebenenfalls Swap anlegen, danach `docker compose build && docker compose up -d`
7. Uptime-Kuma-Monitor auf `http://learning-app:3000/api/health`, 60 s, Retries 2, ntfy-Benachrichtigung an
8. Verify-Checkliste nach Runbook

**Zum Build auf kumo**, weil du dich bewusst dafuer entschieden hast: der Nuxt-Build laeuft neben
Traefik, Authelia, Redis, LLDAP, Beszel, Dozzle, ntfy und Uptime Kuma auf 4 GB. Das Dockerfile
setzt im Builder-Stage deshalb ein Speicherlimit fuer Node, und `docs/DEPLOY.md` beschreibt, wie
du vorher pruefst, ob Swap noetig ist. Falls es trotzdem eng wird, ist der Ausweg billig: im
`compose.yaml` `build: .` durch ein `image: ghcr.io/...` ersetzen, sonst aendert sich nichts. Das
Dockerfile funktioniert fuer beide Wege.

**Dokumentation im Second Brain** entsteht **nicht jetzt**, sondern beim gemeinsamen Deployment,
weil deine Vault-Konvention den IST-Zustand dokumentiert und den gibt es vorher nicht. Geplant
sind dann: `Knowledge/kumo - learning-app.md`, Verlinkung im Services-Hub des Runbooks,
`Dev Logs/<Datum> - VPS learning-app.md`, Nachtrag in `Projects/VPS Infrastructure.md`, eine
Projektnotiz und die deutsche Drive-Datei `08-learning-app.md`.

**Akzeptanzkriterien**

- [ ] App lokal als PWA installierbar, startet offline
- [ ] Playwright-Offline-Test: Netzwerk aus, Session absolvieren, Netzwerk an, Synchronisation belegt
- [ ] Doppeltes Senden derselben Session erzeugt keinen zweiten Datensatz
- [ ] Simulierte abgelaufene Sitzung (302 auf HTML, 401) fuehrt nachweislich **nicht** zu Datenverlust, Banner erscheint, nach Login wird nachsynchronisiert
- [ ] `docker build` erzeugt lokal ein lauffaehiges Image, Healthcheck antwortet
- [ ] `docs/DEPLOY.md` vollstaendig: Setup, Umgebungsvariablen, Update-Weg, Rueckbau
- [ ] `npm run test:full` gruen

**Hier ist der ausdrueckliche Zwischenstopp. Ich frage nach, bevor es weitergeht.**


### Phase 4: Katalog

Die restlichen 16 Spiele als je eigener vertikaler Schnitt, in der Reihenfolge Konzentration,
Gedaechtnis, Logik, Rechnen:

`stroop`, `zeichenvergleich`, `gonogo`, `trailmaking`, `nback`, `zahlenspanne`, `corsi`,
`figurenlernen`, `faktenlernen`, `figurenreihen`, `syllogismen`, `wuerfel`, `ueberschlag`,
`rechenzeichen`, `einheiten`, `datenlesen`.

**Akzeptanzkriterien**

- [ ] Jedes Spiel: Generator, Property-Test, UI, Persistenz, Auswertung, Playwright-Durchlauf
- [ ] `stroop`, `gonogo` und `nback` messen ueber `performance.now()` und praesentieren ueber `requestAnimationFrame`, Messfehler nachweislich unter 20 ms, Praesentationszeitpunkt geloggt
- [ ] `stroop` weist den Interferenzeffekt in Millisekunden aus, kongruent und inkongruent getrennt
- [ ] `gonogo` weist Kommissions- und Omissionsfehler sowie Reaktionszeitvariabilitaet aus
- [ ] `docs/GAMES.md` vollstaendig: Konstrukt, Aufgabenformat, Schwierigkeitsachse, Gewichtskurve, Punkteberechnung je Spiel
- [ ] `npm run test:full` gruen

### Phase 5: Intelligenz

**Dateien:** `server/services/adaptive.ts`, `server/services/plan.ts`, `app/composables/useAdaptive.ts`,
`app/pages/plan.vue`, Erweiterung von `server/api/stats.get.ts` und `app/pages/stats.vue`

**Akzeptanzkriterien**

- [ ] Simulierter Nutzer mit fester Trefferwahrscheinlichkeit schwingt sich auf ein stabiles Schwierigkeitsniveau ein (Vitest)
- [ ] Persoenliche Normierung greift ab zwanzig Sessions, Quelle der Note ist in der Oberflaeche sichtbar
- [ ] Schwachstellenanalyse listet Aufgabentypen absteigend nach Handlungsbedarf, mit Trefferquote und mittlerer Reaktionszeit
- [ ] Tagesplan haelt alle Regeln ein, per Test gegen einen simulierten Verlauf ueber 30 Tage
- [ ] Tageszeitanalyse rechnet nachweislich in Europe/Zurich, auch ueber die Zeitumstellung hinweg

### Phase 6: Promotionsregeln und Standortbestimmung

Hier ist eine Entscheidung faellig, die ich nicht vorwegnehme, weil zwei der sechs Konstrukte
fehlen. Zwei Wege, beide bauen `server/services/promotion.ts` inklusive der vollstaendigen
Grenzfalltabelle, weil das reine Logik ist und sich sauber testen laesst:

- **6a, Standortbestimmung ueber vier Teile.** Ein Modus unter `/exam`, der die vier vorhandenen
  Konstrukte am Stueck durchlaeuft, mit Startzeit-Vermerk und der Empfehlung, abends ab 17:30 zu
  starten. Die Promotionsregeln werden angewendet, das Ergebnis aber klar als **unvollstaendig**
  ausgewiesen, mit Nennung der fehlenden Teile.
- **6b, zurueckstellen.** Nur die getestete Regel-Engine, kein `/exam`-Modus, bis die Sprachteile
  existieren.

Die vier echten ZHAW-Regeln werden in jedem Fall implementiert und getestet:

1. Notendurchschnitt aller Teile mindestens 4.00, Textverstaendnis doppelt gewichtet
2. Von Rechnerischem Denken und Konzentrationsleistung darf hoechstens einer unter 4.0 liegen
3. Von Logischem Denken, Sprachlichem Denken, Wortfluessigkeit und Textverstaendnis darf
   hoechstens einer unter 4.0 liegen, und dieser nicht unter 3.0
4. Das Ergebnis nennt bestanden oder nicht bestanden **und welche Regel gerissen wurde**

**Akzeptanzkriterien**

- [ ] Grenzfalltabelle gruen: exakt 4.00, exakt 3.75 vor Rundung, genau ein Ausreisser auf 3.0, ein Ausreisser auf 2.5
- [ ] Bei 6a: ein Absturz oder Neuladen mitten im Lauf verliert keine bereits absolvierten Teile
- [ ] Bei 6a: das Ergebnis weist die fehlenden Konstrukte unmissverstaendlich aus

---

## 11. Tests

- **Property-basiert je Generator.** Genau eine korrekte Antwort; korrekte Antwort im
  vorgesehenen Wertebereich; bei Multiple Choice keine doppelten Optionen und die richtige Option
  nicht systematisch an derselben Position; bei arithmetischen Aufgaben ganzzahlige Loesungen;
  keine Ausreisser ueber der definierten Obergrenze. 1'000 Durchlaeufe im Normalfall, 10'000 in
  `test:full` (siehe 3.5).
- **Scoring und Promotionsregeln** mit Grenzfalltabelle.
- **Adaptivitaet**: simulierter Nutzer schwingt sich ein.
- **Playwright**: pro Spiel ein Durchlauf von Start bis gespeichertem Ergebnis, plus der
  Offline-Test aus Phase 3.
- **Keine Erfolgsmeldung ohne Beleg.** Kein «funktioniert» ohne ausgefuehrten Testlauf und
  gesehene Ausgabe.

---

## 12. Was nicht gebaut wird

- Kein Mehrbenutzersystem, keine Registrierung, keine Rollen
- Keine Bestenlisten, keine sozialen Funktionen, kein Teilen
- Keine Gamification mit Punkten, Abzeichen, Leveln oder Konfetti
- Keine Push-Benachrichtigungen und keine Erinnerungen, die Druck aufbauen
- Keine KI-generierten Aufgaben zur Laufzeit
- Keine Nachbildung urheberrechtlich geschuetzter Testverfahren
- **Keine Backups** (deine Entscheidung, siehe 2)
- **Keine kuratierten Inhaltsdateien** (deine Entscheidung, siehe 3.2)

---

## 13. Offene Punkte

1. **Design-Abnahme in Phase 1.** Der Prototyp fehlt, also baue ich die Designsprache neu und
   zeige sie dir, bevor 21 weitere Spiele darauf aufsetzen.
2. **Phase 6, Weg 6a oder 6b.** Entscheidung faellt am Ende von Phase 5, nicht jetzt.
3. **Schriftwahl** Space Grotesk und JetBrains Mono, zur Abnahme mit dem Design-Screen.
4. **Inbetriebnahme auf kumo** ist ausdruecklich nicht Teil dieser Arbeit. Ich baue die App und
   liefere die Deployment-Artefakte; den Server fasse ich nicht an. Das machen wir spaeter
   gemeinsam Schritt fuer Schritt.
