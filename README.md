# learning-app

A cognitive training app for short daily sessions. It ships 22 procedurally generated exercises
across arithmetic, logical reasoning, verbal fluency, concentration and working memory, adapts
the difficulty to the player, and grades every result on the Swiss 1 to 6 scale with a visible
pass line at 4.0.

It is a Progressive Web App: it installs to the home screen, runs fully offline and syncs results
once a connection is back. The interface is in Swiss German.

The exercise set and the exam simulation follow the structure of the written aptitude test for
the BSc in Applied Psychology at ZHAW. Grades are the app's own benchmark and do not predict an
actual test result.

## Features

- **22 exercises, no item bank.** Every item is generated from a seeded random number generator,
  so there is nothing to memorise and every session can be reproduced from its seed.
- **Adaptive difficulty.** A 2-up/1-down staircase keeps each exercise near the edge of what the
  player can do. The level is persisted per exercise on the server.
- **Grading that tracks progress.** Scores are difficulty weighted, then mapped to a 1 to 6 grade.
  After twenty sessions of an exercise the grade switches from fixed start thresholds to a
  personal norm. The interface always shows which of the two applies.
- **Offline first.** Results go into an IndexedDB outbox before they are sent. Nothing is lost when
  the network drops or the auth session expires mid-session.
- **Statistics.** Grade trends per area, a radar with the 4.0 ring, a weakness analysis per item
  type, reaction time spread, performance by time of day, streaks and weekly minutes.
- **Daily plan.** Four to six exercises, about thirteen minutes, weighted toward the weakest areas,
  never more than two concentration tasks, and nothing left idle for longer than ten days.
- **Exam simulation.** Runs one exercise per exam section in a fixed order without breaks, then
  evaluates the promotion rules and names every rule that was broken. A run survives a crash or a
  reload and can be resumed.
- **Data export.** The complete history as JSON or as CSV per table.

## Exercises

| Area | Exercise | What it trains |
|---|---|---|
| Arithmetic | Kopfrechnen | Mental arithmetic sprint: percentages, fractions, rule of three, speed and distance, mixtures |
| | Überschlag | Estimating the order of magnitude, five candidates with the classic magnitude mistakes as distractors |
| | Rechenzeichen einsetzen | Insert operators so an equation holds, order of operations applies, the solution is always unique |
| | Umrechnen | Unit conversion including area, volume, time, speed and map scale |
| | Tabellen und Diagramme | Reading generated bar, line and pie charts and tables |
| Logical reasoning | Zahlenreihen | Number series built from twelve formation rules, checked against ambiguous readings |
| | Matrizen | Raven style 3×3 matrices whose distractors come from plausible misreadings |
| | Figurenreihen | Figure sequences driven by rotation, mirroring, count, fill and position |
| | Schlussfolgerungen | Syllogisms whose validity is decided by a model checker |
| | Würfel und Rotation | Cube nets and mental rotation, drawn in isometric SVG |
| Verbal fluency | Wortflüssigkeit | Producing words for a letter, a category or both within one minute |
| Concentration | Durchstreichtest | A d2 style cancellation task with omission, commission and row variability |
| | Zahlen-Symbol | Digit symbol substitution against a visible legend |
| | Stroop | Colour word interference, reported in milliseconds |
| | Zeichenvergleich | Spotting a single differing character between two strings |
| | Go und No-Go | Response inhibition with reaction time variability |
| | Zahlenpfad | Trail making, parts A and B |
| Memory | N-Back | Visual, verbal or dual n-back with n from 1 to 4 |
| | Zahlenspanne | Digit span, forward and backward |
| | Corsi-Blöcke | Spatial span on an irregular block layout |
| | Figuren lernen | Learning abstract figures, a distraction phase, then recognition |
| | Fakten lernen | Learning short profiles, a distraction phase, then targeted recall |

d2, Stroop, Corsi and n-back are implementations of the paradigms described in the research
literature. No commercial test material, norm tables or answer sheets are used.

## How it works

### Architecture

The client is a Nuxt 4 single page app with a prerendered shell. The server is a set of Nitro
routes backed by SQLite through Drizzle ORM. Migrations run automatically when the server starts.
A Workbox service worker precaches the app shell, which is what lets the app start without a
connection. API requests are never cached.

### Exercises

Every exercise is a folder under `app/games/` implementing one interface:

```ts
interface GameDefinition {
  slug: string
  construct: Construct
  mode: 'sprint' | 'block' | 'span'
  difficultyRange: [number, number]
  thresholds: { raw1: number; raw4: number; raw6: number }
  weight(difficulty: number): number
  generate(difficulty: number, rng: Rng): Trial | TrialBlock
  score(trials: TrialResult[], durationS: number): RawScore
}
```

A shared engine runs all of them, so timing, logging and scoring behave identically everywhere.
`sprint` fits as many items as possible into a fixed time, `block` works through a fixed number of
items, and `span` grows the length until two lengths in a row fail. Every single item is stored
with its parameters, the response, correctness, reaction time and the moment it was painted.
Timing uses `performance.now()` with presentation driven by `requestAnimationFrame`.

### Scoring

A staircase holds accuracy roughly constant by design, so accuracy alone would flatten the grade
over time even while the player improves. The raw score therefore weights every correctly solved
item by its difficulty:

```
raw = sum of weight(difficulty) over correct items / minutes
```

Span and recall tasks score the span reached or the share recalled instead. The raw score is mapped
to a grade piecewise linearly, with `raw4` sitting exactly on the 4.0 pass line. From twenty
sessions on, the grade comes from a z-score against the player's own last ninety days, anchored so
that the median of the first ten sessions maps to 4.0.

### Sync

Sessions get a UUIDv7 on the client and the server inserts with `INSERT OR IGNORE`, so a retry can
never create a duplicate. An outbox entry is removed only on a JSON 2xx response that echoes the
session id. A login redirect or an HTML page is never mistaken for success, the entry stays queued
and is sent again after the next sign in.

Day boundaries, streaks and the time of day analysis are computed in Europe/Zurich, daylight saving
transitions included.

## Tech stack

Nuxt 4, Vue 3 and TypeScript · Nitro · SQLite with better-sqlite3 and Drizzle ORM · Pinia ·
IndexedDB · Workbox via `@vite-pwa/nuxt` · Tailwind CSS 4 with a custom token layer · self hosted
Space Grotesk and JetBrains Mono · Vitest with happy-dom · Playwright · Node 24 · Docker

## Getting started

```bash
npm install
npm run dev
```

The app runs at http://localhost:3000. The database is created on first start under
`data/learning.db`.

| Script | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build including the prerendered app shell |
| `npm test` | Unit, property and component tests |
| `npm run test:watch` | Watch mode with fewer property runs for fast feedback |
| `npm run e2e:install` | Install the Playwright browser once |
| `npm run e2e` | End to end tests |
| `npm run db:generate` | Generate a Drizzle migration after a schema change |

## Testing

- **Property tests.** Every generator runs through a shared contract ten thousand times: output is
  deterministic for a seed, parameters are JSON serialisable, options are unique, and the correct
  answer is not biased toward one position. Each exercise adds its own properties on top, derived
  independently of the generator code.
- **Component tests** under happy-dom for the timing critical exercises.
- **End to end tests** that play every exercise to a stored result, plus a test that drops the
  network mid-session and verifies the result syncs once it is back.
- **A contract test** that reads the source of every exercise and enforces the project conventions.

## Deployment

```bash
docker compose up -d --build
```

The container serves the app on port 3000 and keeps its data in the named volume `learning-data`.
It exposes a health endpoint at `/api/health`, and `/api/export` returns the full history.

The app is built for a single user and has **no login of its own**. Run it behind a reverse proxy
that handles authentication, for example Traefik with a forward auth middleware.

## Project structure

```
app/
  components/   grade band, number pad, game frame, charts
  composables/  engine, session, offline outbox, exam run, theme
  games/        one folder per exercise, registered in index.ts
  pages/        home, play, stats, plan, exam, settings
  stores/       sync state
server/
  api/          sessions, stats, plan, settings, exam, export, health
  db/           schema, migrations, client
  services/     persistence, statistics, daily plan, day log, streak
shared/         rng, types, scoring, adaptivity, dates, span, promotion rules, sync
docs/           exercise catalogue and the exercise contract (German)
e2e/            Playwright specs
```

## Adding an exercise

Create a folder under `app/games/` with `definition.ts`, `generator.ts`, `Play.vue` and
`generator.test.ts`, then register it in `app/games/index.ts`. `docs/GAME-CONTRACT.md` describes
the rules and `docs/GAMES.md` documents every existing exercise. `app/games/contract.test.ts` fails
as soon as a folder is not registered or a convention is broken.

## Not included

Two of the six exam sections, verbal reasoning and reading comprehension, need curated item banks
rather than generators and are not part of the app. The exam simulation therefore covers four
sections and marks its result as incomplete. The promotion rules themselves are implemented and
tested for all six.
