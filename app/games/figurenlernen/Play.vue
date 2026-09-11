<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createRng } from '~~/shared/rng'
import type { ChoiceOption } from '~~/shared/types'
import type { GameFinishPayload } from '~/composables/useGameSession'
import type { AblenkAufgabe, SchnittPayload } from './generator'
import {
  clampDifficulty,
  figureToSvg,
  generateFigurenBlock,
  naechsteStufe,
  schnittToSvg,
} from './generator'
import definition from './definition'

const props = defineProps<{ seed: number; difficulty: number; durationS?: number }>()
const emit = defineEmits<{ finish: [GameFinishPayload] }>()

const stufe = clampDifficulty(props.difficulty)
const satz = generateFigurenBlock(stufe, createRng(props.seed))
const lernstoff = satz.payload
const figurenSvg = lernstoff.figuren.map((figur) => figureToSvg(figur))

const engine = useEngine({
  definition,
  seed: props.seed,
  startDifficulty: props.difficulty,
  durationS: props.durationS,
  itemCount: satz.trials.length,
})
const { current, feedback } = engine

useGameSession(engine, (payload) =>
  emit('finish', { ...payload, difficulty: naechsteStufe(stufe, payload.rawScore) }),
)

const TICK_MS = 100

const ERKENN_OPTIONEN: ChoiceOption[] = [
  { id: 'gesehen', label: 'Gesehen' },
  { id: 'neu', label: 'Neu' },
]

const phase = ref<'lernen' | 'ablenkung' | 'erkennen'>('lernen')
const restMs = ref(lernstoff.lernzeitMs)
const ablenkNummer = ref(0)
const gewaehlt = ref<number | null>(null)
let ticker: ReturnType<typeof setInterval> | null = null

const sekunden = computed(() => Math.ceil(restMs.value / 1000))
const figurZeitMs = computed(() =>
  Math.max(1, Math.round(lernstoff.lernzeitMs / lernstoff.figuren.length)),
)
const figurIndex = computed(() =>
  Math.min(
    lernstoff.figuren.length - 1,
    Math.floor((lernstoff.lernzeitMs - restMs.value) / figurZeitMs.value),
  ),
)
const figurSvg = computed(() => figurenSvg[figurIndex.value] ?? '')

const aufgabe = computed<AblenkAufgabe | null>(
  () => lernstoff.ablenkung[ablenkNummer.value % lernstoff.ablenkung.length] ?? null,
)
const ablenkOptionen = computed<ChoiceOption[]>(() =>
  (aufgabe.value?.optionen ?? []).map((wert, index) => ({ id: `zahl-${index}`, label: String(wert) })),
)

const schnitt = computed(() => (current.value?.payload ?? null) as SchnittPayload | null)
const schnittSvg = computed(() => (schnitt.value ? schnittToSvg(schnitt.value.schnitt) : ''))
const gesperrt = computed(() => feedback.value !== null)
const loesungIndex = computed(() => (feedback.value ? (feedback.value.expected === true ? 0 : 1) : null))

const eyebrow = computed(() => {
  if (phase.value === 'lernen') return 'Figur einprägen'
  if (phase.value === 'ablenkung') return 'Zwischenrechnen'
  return 'Schon gesehen?'
})

const statusText = computed(() => {
  if (phase.value === 'lernen') {
    return `Figur ${figurIndex.value + 1} von ${lernstoff.figuren.length}`
  }
  if (phase.value === 'ablenkung') return 'Rechnen, bis die Zeit um ist'
  if (feedback.value?.correct === true) return '✓ richtig'
  if (feedback.value) {
    return feedback.value.expected === true
      ? '✗ falsch, dieser Ausschnitt war gelernt'
      : '✗ falsch, dieser Ausschnitt war neu'
  }
  return schnitt.value ? `Ausschnitt ${schnitt.value.nummer} von ${schnitt.value.gesamt}` : ''
})

function stopTicker() {
  if (ticker) clearInterval(ticker)
  ticker = null
}

function tick() {
  restMs.value = Math.max(0, restMs.value - TICK_MS)
  if (restMs.value > 0) return
  if (phase.value === 'lernen') {
    phase.value = 'ablenkung'
    restMs.value = lernstoff.ablenkzeitMs
    return
  }
  stopTicker()
  phase.value = 'erkennen'
  engine.start()
}

function rechnen() {
  if (phase.value !== 'ablenkung') return
  ablenkNummer.value++
}

function antworten(index: number) {
  if (phase.value !== 'erkennen' || gesperrt.value) return
  gewaehlt.value = index
  engine.submit(index === 0)
}

watch(current, () => {
  gewaehlt.value = null
})

onMounted(() => {
  ticker = setInterval(tick, TICK_MS)
})

onBeforeUnmount(() => {
  stopTicker()
  engine.dispose()
})
</script>

<template>
  <GameFrame :engine="engine">
    <div class="run">
      <div class="run__kopf">
        <p class="eyebrow">{{ eyebrow }}</p>
        <span v-if="phase !== 'erkennen'" class="num run__uhr" aria-hidden="true">{{ sekunden }} s</span>
      </div>

      <div class="run__stage card">
        <div
          v-if="phase === 'lernen'"
          class="run__art"
          role="img"
          :aria-label="`Abstrakte Figur ${figurIndex + 1} von ${lernstoff.figuren.length}`"
          v-html="figurSvg"
        />
        <p v-else-if="phase === 'ablenkung'" class="num run__rechnung">{{ aufgabe?.text ?? '' }}</p>
        <div v-else class="run__art" role="img" aria-label="Ausschnitt einer Figur" v-html="schnittSvg" />
      </div>

      <p class="run__status" role="status">{{ statusText }}</p>

      <div class="run__foot">
        <div v-if="phase === 'lernen'" class="run__punkte">
          <span
            v-for="stelle in lernstoff.figuren.length"
            :key="stelle"
            class="run__punkt"
            :class="{ 'is-aktiv': stelle - 1 === figurIndex, 'is-fertig': stelle - 1 < figurIndex }"
          />
        </div>

        <ChoiceGrid
          v-else-if="phase === 'ablenkung'"
          :options="ablenkOptionen"
          :columns="3"
          @select="rechnen"
        />

        <ChoiceGrid
          v-else
          :options="ERKENN_OPTIONEN"
          :columns="2"
          :disabled="gesperrt"
          :reveal-index="loesungIndex"
          :chosen-index="gewaehlt"
          @select="antworten"
        />
      </div>
    </div>
  </GameFrame>
</template>

<style scoped>
.run {
  display: flex;
  flex: 1;
  flex-direction: column;
}

.run__kopf {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding-block: 0.25rem 0.75rem;
}

.run__uhr {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--muted);
}

.run__stage {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  width: 100%;
  padding: 1rem;
  color: var(--ink);
}

.run__art {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
}

.run__art :deep(svg) {
  width: 100%;
  height: 100%;
}

.run__rechnung {
  font-size: clamp(2rem, 11vw, 3rem);
  font-weight: 600;
  letter-spacing: -0.02em;
}

.run__status {
  min-height: 1.75rem;
  padding-block: 0.75rem 0.5rem;
  font-size: 0.875rem;
  text-align: center;
  color: var(--muted);
}

.run__foot {
  margin-top: auto;
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
}

.run__punkte {
  display: flex;
  min-height: 3.5rem;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.run__punkt {
  width: 0.5rem;
  height: 0.5rem;
  border: 1px solid var(--rule);
  border-radius: 50%;
  background-color: var(--sunken);
  transition: background-color 120ms ease, transform 120ms ease;
}

.run__punkt.is-fertig {
  background-color: var(--rule);
}

.run__punkt.is-aktiv {
  background-color: var(--accent);
  border-color: var(--accent);
  transform: scale(1.4);
}
</style>
