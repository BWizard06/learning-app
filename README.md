# learning-app

Kognitives Training als Progressive Web App. Einzelnutzer, offline lauffähig, betrieben als
Docker-Service auf dem VPS `kumo` hinter Traefik und Authelia.

## Losfahren

```bash
npm install
npm run dev
```

Die Datenbank legt sich beim ersten Start unter `data/learning.db` selbst an, die Migrationen
laufen automatisch.

## Befehle

| | |
|---|---|
| `npm run dev` | Entwicklungsserver |
| `npm run build` | Produktionsbuild inklusive vorgerendertem App-Shell |
| `npm test` | Unit- und Property-Tests, 10'000 Durchläufe pro Generator |
| `npm run test:watch` | dasselbe mit 300 Durchläufen, für schnelles Feedback beim Tippen |
| `npm run e2e` | Playwright über jedes Spiel plus die Offline-Kette |
| `npm run db:generate` | neue Drizzle-Migration aus dem Schema |

## Aufbau

```
app/
  components/   Notenband, Timer, Ziffernblock, Spielrahmen, Diagramme
  composables/  Engine, Sitzung, Offline-Outbox, Prüfungslauf, Theme
  games/        ein Ordner pro Spiel, plus index.ts als Registrierung
  pages/        index, play/[slug], stats, plan, exam, settings
  stores/       Synchronisation
server/
  api/          sessions, stats, plan, settings, exam, export, health
  db/           schema.ts, migrations/, client.ts
  services/     persist, stats, plan, daylog, streak
shared/         rng, types, scoring, adaptive, dates, promotion, exam, sync
docs/           PLAN.md, DECISIONS.md, GAMES.md, GAME-CONTRACT.md, DEPLOY.md
```

## Ein neues Spiel

`docs/GAME-CONTRACT.md` beschreibt den verbindlichen Aufbau. Kurz: ein Ordner unter `app/games/`
mit `definition.ts`, `generator.ts`, `Play.vue` und `generator.test.ts`, dann ein Eintrag in
`app/games/index.ts`.

`app/games/contract.test.ts` prüft die Regeln maschinell und schlägt fehl, wenn ein Ordner nicht
registriert ist, ein Generator unrein wird, ein Kommentar im Code steht oder eine zweite
Statusmeldung dazukommt.

## Betrieb

`docs/DEPLOY.md` beschreibt die Inbetriebnahme auf kumo Schritt für Schritt. Es gibt bewusst keine
automatischen Sicherungen; `GET /api/export` liefert den ganzen Verlauf als JSON oder CSV.
