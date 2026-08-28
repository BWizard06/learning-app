<script setup lang="ts">
import { computed, defineAsyncComponent, ref, shallowRef } from 'vue'
import { CONSTRUCT_LABELS, type SessionPayload } from '~~/shared/types'
import type { GameFinishPayload } from '~/composables/useGameSession'
import { gameBySlug } from '~/games'
import { playComponentLoader } from '~/games/registry'

const route = useRoute()
const slug = computed(() => String(route.params.slug))
const definition = computed(() => gameBySlug(slug.value))

if (!definition.value) {
  throw createError({ statusCode: 404, statusMessage: 'Spiel nicht gefunden', fatal: true })
}

useHead({ title: () => definition.value?.name ?? 'Training' })

const loader = playComponentLoader(slug.value)
const PlayComponent = loader ? defineAsyncComponent(loader) : null

type Phase = 'intro' | 'playing' | 'result'
const phase = ref<Phase>('intro')
const seed = ref(0)
const startDifficulty = ref(definition.value!.difficultyRange[0])
const result = shallowRef<GameFinishPayload | null>(null)
const durationOverride = computed(() => {
  if (!import.meta.dev) return undefined
  const raw = Number.parseInt(String(route.query.dauer ?? ''), 10)
  return Number.isFinite(raw) && raw > 0 ? raw : undefined
})
const { state, note, error, submit } = useSessionSubmit()

const durationText = computed(() => {
  const seconds = definition.value!.defaultDurationS
  return seconds >= 60 ? `${Math.round(seconds / 60)} Minuten` : `${seconds} Sekunden`
})

const modeText = computed(() => {
  switch (definition.value!.mode) {
    case 'sprint':
      return 'So viele Aufgaben wie möglich in fester Zeit.'
    case 'block':
      return 'Feste Anzahl Aufgaben, die Zeit wird gemessen.'
    case 'span':
      return 'Die Länge wächst, bis zwei Fehler in Folge kommen.'
    default:
      return 'Text lesen, danach Fragen beantworten.'
  }
})

function begin() {
  seed.value = randomSeed()
  startDifficulty.value = readDifficulty(slug.value, definition.value!.difficultyRange[0])
  result.value = null
  phase.value = 'playing'
}

async function onFinish(payload: GameFinishPayload) {
  result.value = payload
  phase.value = 'result'
  writeDifficulty(slug.value, payload.difficulty)

  const startedAt = Date.now() - Math.round(payload.durationS * 1000)
  const session: SessionPayload = {
    id: newSessionId(),
    gameSlug: slug.value,
    startedAt,
    finishedAt: Date.now(),
    durationMs: Math.round(payload.durationS * 1000),
    difficulty: payload.difficulty,
    rawScore: Math.round(payload.rawScore * 1000) / 1000,
    accuracy: Math.round(payload.accuracy * 10000) / 10000,
    seed: payload.seed,
    mode: definition.value!.mode,
    deviceId: useDeviceId(),
    metrics: payload.metrics,
    trials: payload.trials,
  }
  await submit(session)
}

const accuracyText = computed(() =>
  result.value ? `${Math.round(result.value.accuracy * 100)} %` : '—',
)
</script>

<template>
  <div v-if="phase === 'intro'" class="shell intro">
    <NuxtLink to="/" class="intro__back">Zurück</NuxtLink>
    <p class="eyebrow">{{ CONSTRUCT_LABELS[definition!.construct] }}</p>
    <h1 class="intro__title">{{ definition!.name }}</h1>
    <p class="intro__blurb">{{ definition!.blurb }}</p>

    <dl class="card intro__facts">
      <div>
        <dt>Dauer</dt>
        <dd class="num">{{ durationText }}</dd>
      </div>
      <div>
        <dt>Ablauf</dt>
        <dd>{{ modeText }}</dd>
      </div>
    </dl>

    <button type="button" class="intro__start tap" @click="begin">Starten</button>
  </div>

  <ClientOnly v-else-if="phase === 'playing'">
    <component
      :is="PlayComponent"
      v-if="PlayComponent"
      :seed="seed"
      :difficulty="startDifficulty"
      :duration-s="durationOverride"
      @finish="onFinish"
    />
  </ClientOnly>

  <div v-else class="shell result">
    <p class="eyebrow">{{ definition!.name }}</p>
    <ScoreBand :note="note?.value ?? null" :source="note?.source ?? 'thresholds'" label="Note" />

    <dl class="card result__facts">
      <div>
        <dt>Trefferquote</dt>
        <dd class="num">{{ accuracyText }}</dd>
      </div>
      <div>
        <dt>Aufgaben</dt>
        <dd class="num">{{ result?.trials.length ?? 0 }}</dd>
      </div>
      <div>
        <dt>Schwierigkeit</dt>
        <dd class="num">{{ result ? result.difficulty.toFixed(1).replace('.', ',') : '—' }}</dd>
      </div>
      <div>
        <dt>Rohwert</dt>
        <dd class="num">{{ result ? result.rawScore.toFixed(1).replace('.', ',') : '—' }}</dd>
      </div>
    </dl>

    <p v-if="state === 'pending'" class="result__sync">
      Ergebnis noch nicht gespeichert. {{ error }}
    </p>
    <p v-else-if="state === 'expired'" class="result__sync">
      Sitzung abgelaufen. Seite neu laden und anmelden, dann wird nachgetragen.
    </p>

    <div class="result__actions">
      <button type="button" class="result__again tap" @click="begin">Nochmal</button>
      <NuxtLink to="/" class="result__home tap">Zur Übersicht</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.intro,
.result {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 100dvh;
  padding-block: 2rem;
  padding-bottom: max(2rem, env(safe-area-inset-bottom));
}

.intro__back {
  align-self: flex-start;
  font-size: 0.875rem;
  color: var(--muted);
  text-decoration: none;
}

.intro__title {
  font-size: 1.875rem;
}

.intro__blurb {
  color: var(--muted);
}

.intro__facts,
.result__facts {
  display: grid;
  gap: 0.875rem;
  margin: 0.5rem 0 0;
  padding: 1rem;
}

.result__facts {
  grid-template-columns: repeat(2, 1fr);
}

.intro__facts dt,
.result__facts dt {
  font-size: 0.75rem;
  color: var(--faint);
}

.intro__facts dd,
.result__facts dd {
  margin: 0.125rem 0 0;
  font-size: 1.0625rem;
}

.intro__start {
  margin-top: auto;
}

.intro__start,
.result__again {
  padding-block: 1rem;
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--accent-ink);
  background-color: var(--accent);
  border-radius: var(--radius-key);
}

.result__actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 1.5rem;
}

.result__home {
  padding-block: 0.875rem;
  font-size: 0.9375rem;
  text-align: center;
  color: var(--muted);
  text-decoration: none;
}

.result__sync {
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  color: var(--ink);
  background-color: var(--gold-soft);
  border: 1px solid var(--gold);
  border-radius: var(--radius-key);
}
</style>
