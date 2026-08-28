# Vertrag fuer ein Spiel

Verbindlich fuer jedes neue Spiel. Referenzimplementierung: `app/games/kopfrechnen/`.

## Dateien

```
app/games/<slug>/
  definition.ts        Metadaten, Schwellen, Gewicht, Punkteberechnung
  generator.ts         erzeugt Items, rein und deterministisch
  Play.vue             Oberflaeche
  generator.test.ts    Property-Tests
```

`app/games/index.ts` wird **nicht** vom Spiel selbst angefasst, die Registrierung erfolgt zentral.

## Harte Regeln

1. **Keine Kommentare im Code.** Weder in TypeScript noch in Vue.
2. **Oberflaeche auf Deutsch, Schweizer Rechtschreibung.** Nie `ß`, immer `ss`. Keine Gedanken
   striche in Fliesstexten der Oberflaeche, stattdessen Kommas oder eigene Saetze.
   Bezeichner, Slugs und `item_type` bleiben Englisch oder klein geschriebenes Deutsch ohne Umlaute.
3. **Der Generator ist rein.** Zufall kommt ausschliesslich aus dem uebergebenen `Rng`. Kein
   `Math.random`, kein `Date.now`, kein Zugriff auf `window` oder `document`. Gleicher Seed
   erzeugt bitgleich dieselbe Item-Folge.
4. **`params` enthaelt Typ und Parameter, nie den gerenderten Text.** Aus `params` muss sich die
   Aufgabe rekonstruieren lassen; der Fliesstext gehoert in `payload`.
5. **Bei Multiple Choice** ist genau eine Option richtig, alle Distraktoren entstehen aus
   typischen Fehlern, nie aus Zufallszahlen. Keine doppelten Optionen, die richtige Position wird
   gemischt.
6. **Alle Eingaben einhaendig mit dem Daumen erreichbar**, Bedienelemente unten. Bei Zahlen der
   eigene `NumberPad`, nie die Systemtastatur. Schriftgroesse in Eingabefeldern mindestens 16 px.
7. **Farbe ist nie der einzige Bedeutungstraeger.** Richtig und falsch bekommen zusaetzlich ein
   Zeichen.
7a. **Genau eine Statusmeldung pro Spiel.** Die Rueckmeldung steht in einem sichtbaren Element
   mit `role="status"`, das das Spiel selbst rendert. `GameFrame` liefert bewusst keine zweite,
   versteckte Meldung, sonst liest ein Screenreader alles doppelt vor.
8. `prefers-reduced-motion` respektieren, Tastaturbedienung am Desktop moeglich.

## Typen

```ts
interface GameDefinition {
  slug: string
  name: string
  construct: 'rechnen' | 'logik' | 'sprache' | 'wortfluss' | 'konzentration' | 'gedaechtnis' | 'text'
  blurb: string
  mode: 'sprint' | 'block' | 'span' | 'reading'
  defaultDurationS: number
  itemCount?: number
  difficultyRange: [number, number]
  thresholds: { raw1: number; raw4: number; raw6: number }
  weight(difficulty: number): number
  generate(difficulty: number, rng: Rng): Trial | TrialBlock
  score(trials: TrialResult[], durationS: number): RawScore
  isCorrect?(trial: Trial, response: JsonValue): boolean
}

interface Trial<TPayload = unknown, TAnswer = JsonValue> {
  itemType: string
  difficulty: number
  params: JsonObject
  payload: TPayload
  answer: TAnswer
  options?: ChoiceOption[]
  correctIndex?: number
}
```

`Rng` bietet `next`, `int(min,max)`, `float`, `bool(p)`, `pick`, `weighted`, `shuffle`,
`sample(items,n)`, `sign`, `pickIndex`.

## Rohwert und Note

Ausser bei `span` gilt

```
rawScore = summe(weight(difficulty) fuer korrekt geloeste Items) / dauerMinuten
```

Dafuer gibt es `weightedThroughput(results, durationS, weight)` und `accuracyOf(results)` aus
`~~/shared/scoring`, plus `linearWeight(range, min, max)` fuer die Gewichtskurve.

`thresholds` bildet den Rohwert stueckweise linear auf 1 bis 6 ab, `raw4` liegt exakt auf der
Bestehensgrenze. Die Schwellen sind Startwerte und duerfen grosszuegig geschaetzt sein, sie
werden ab zwanzig Sessions durch die persoenliche Normierung abgeloest.

## Play.vue

```vue
<script setup lang="ts">
import definition from './definition'
import type { GameFinishPayload } from '~/composables/useGameSession'

const props = defineProps<{ seed: number; difficulty: number; durationS?: number }>()
const emit = defineEmits<{ finish: [GameFinishPayload] }>()

const engine = useEngine({
  definition,
  seed: props.seed,
  startDifficulty: props.difficulty,
  durationS: props.durationS,
})
const { current, feedback } = engine

useGameSession(engine, (payload) => emit('finish', payload))

onMounted(() => engine.start())
onBeforeUnmount(() => engine.dispose())
</script>

<template>
  <GameFrame :engine="engine">
    ...
  </GameFrame>
</template>
```

Automatisch verfuegbar ohne Import: `useEngine`, `useGameSession`, `GameFrame`, `NumberPad`,
`ChoiceGrid`, `ScoreBand`. `engine.submit(response)` meldet eine Antwort, `engine.finish()`
beendet vorzeitig.

Bei `engine.feedback.value !== null` laeuft die Rueckmeldung, in dieser Zeit sind Eingaben
gesperrt.

## Tests

`generator.test.ts` ruft immer den geteilten Contract auf:

```ts
import { runGeneratorContract } from '~~/shared/testing/generator-contract'
import { propertyRuns } from '~~/shared/testing/property'
import definition from './definition'

runGeneratorContract(definition, { expectIntegerAnswer: true, minItemTypes: 5 })
```

Der Contract prueft Determinismus, JSON-Serialisierbarkeit von `params`, Optionen ohne Duplikate,
gueltigen `correctIndex` und dass die richtige Antwort nicht systematisch an derselben Position
steht. Dazu kommen spielspezifische Property-Tests, die die Loesung unabhaengig nachrechnen.

Laufen muss: `npx vitest run app/games/<slug>` und `PROPERTY_RUNS=10000 npx vitest run app/games/<slug>`.
