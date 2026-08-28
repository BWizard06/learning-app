<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, shallowRef } from 'vue'
import { startTimeNote } from '~~/shared/exam'
import { localHour } from '~~/shared/dates'
import type { SessionPayload } from '~~/shared/types'
import type { GameFinishPayload } from '~/composables/useGameSession'
import { gameBySlug } from '~/games'
import { playComponentLoader } from '~/games/registry'
import { useSyncStore } from '~/stores/sync'
import type { ExamRunState } from '~/composables/useExamRun'

useHead({ title: 'Prüfungssimulation' })

const exam = useExamRun()
const sync = useSyncStore()

const phase = ref<'intro' | 'running' | 'result'>('intro')
const resumable = shallowRef<ExamRunState | null>(null)
const ready = ref(false)
const repeatSeed = ref('')

onMounted(() => {
  resumable.value = exam.loadResumable()
  ready.value = true
})

const clockNote = computed(() => {
  const now = new Date()
  return startTimeNote(localHour(now.getTime()), now.getMinutes())
})

const totalMinutes = computed(() =>
  Math.round(
    exam.parts.value.reduce((sum, part) => sum + (gameBySlug(part.slug)?.defaultDurationS ?? 0), 0) / 60,
  ),
)

const currentComponent = computed(() => {
  const part = exam.currentPart.value
  if (!part) return null
  const loader = playComponentLoader(part.slug)
  return loader ? defineAsyncComponent(loader) : null
})

const currentSeed = computed(() =>
  exam.state.value ? exam.partSeed(exam.state.value.partIndex) : 0,
)

function begin(seed?: number) {
  exam.start(seed === undefined ? {} : { seed })
  phase.value = 'running'
}

function beginRepeat() {
  const parsed = Number.parseInt(repeatSeed.value, 10)
  if (Number.isFinite(parsed) && parsed > 0) begin(parsed >>> 0)
}

function continueRun() {
  if (!resumable.value) return
  exam.resume(resumable.value)
  phase.value = exam.finished.value ? 'result' : 'running'
}

function discardRun() {
  exam.clearStored()
  resumable.value = null
}

async function onPartFinish(payload: GameFinishPayload) {
  const part = exam.currentPart.value
  if (!part) return

  exam.recordPart({
    slug: part.slug,
    rawScore: payload.rawScore,
    accuracy: payload.accuracy,
    durationS: payload.durationS,
    seed: payload.seed,
  })

  const definition = gameBySlug(part.slug)!
  const startedAt = Date.now() - Math.round(payload.durationS * 1000)
  const session: SessionPayload = {
    id: newSessionId(),
    gameSlug: part.slug,
    startedAt,
    finishedAt: Date.now(),
    durationMs: Math.round(payload.durationS * 1000),
    difficulty: payload.difficulty,
    rawScore: Math.round(payload.rawScore * 1000) / 1000,
    accuracy: Math.round(payload.accuracy * 10000) / 10000,
    seed: payload.seed,
    mode: definition.mode,
    deviceId: useDeviceId(),
    metrics: payload.metrics,
    trials: payload.trials,
  }
  await sync.submit(session)

  if (exam.finished.value) await finishRun()
}

async function finishRun() {
  phase.value = 'result'
  const state = exam.state.value
  const verdict = exam.verdict.value
  if (!state || !verdict) return

  await $fetch('/api/exam', {
    method: 'POST',
    body: {
      id: state.id,
      startedAt: state.startedAt,
      finishedAt: Date.now(),
      seed: state.seed,
      repeatedSeed: state.repeatedSeed,
      partNotes: exam.partNotes.value,
      passed: verdict.passed && verdict.complete,
      verdict,
    },
  }).catch(() => {})

  exam.clearStored()
}

function noteText(note: number | undefined): string {
  return note === undefined ? '—' : note.toFixed(1).replace('.', ',')
}

const startedClock = computed(() => {
  if (!exam.state.value) return ''
  return new Intl.DateTimeFormat('de-CH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Zurich',
  }).format(new Date(exam.state.value.startedAt))
})
</script>

<template>
  <div v-if="phase === 'intro'" class="shell exam">
    <NuxtLink to="/" class="exam__back">Zurück</NuxtLink>
    <p class="eyebrow">Prüfungssimulation</p>
    <h1 class="exam__title">Ein Durchgang am Stück</h1>

    <p class="exam__lead">
      {{ exam.parts.value.length }} Teile hintereinander, ohne Pause und ohne Rücksprung, etwa
      <span class="num">{{ totalMinutes }}</span> Minuten. Danach wird nach den Promotionsregeln der
      ZHAW ausgewertet.
    </p>

    <div v-if="exam.missing.value.length" class="exam__warning">
      <p>
        <strong>Dieser Lauf ist unvollständig.</strong> Für
        {{ exam.missing.value.length === 1 ? 'ein Konstrukt' : 'zwei Konstrukte' }} gibt es in dieser
        App noch kein Spiel, deshalb fehlen sie im Durchgang und in der Auswertung.
      </p>
      <p class="exam__warning-list">
        Fehlend:
        {{ exam.missing.value.map((c) => (c === 'sprache' ? 'Sprachliches Denken' : 'Textverständnis')).join(', ') }}
      </p>
      <p>
        Textverständnis zählt in der echten Wertung doppelt. Ein Ergebnis hier sagt darum wenig über
        einen echten Prüfungsausgang.
      </p>
    </div>

    <ol class="card exam__parts">
      <li v-for="(part, index) in exam.parts.value" :key="part.slug">
        <span class="num exam__part-index">{{ index + 1 }}</span>
        <span class="exam__part-label">{{ part.label }}</span>
        <span class="exam__part-game">{{ gameBySlug(part.slug)?.name }}</span>
      </li>
    </ol>

    <p class="exam__clock">{{ clockNote }}</p>

    <div v-if="resumable" class="exam__resume">
      <p>Ein angefangener Durchgang liegt noch vor, bei Teil {{ resumable.partIndex + 1 }}.</p>
      <div class="exam__resume-actions">
        <button type="button" class="exam__start tap" @click="continueRun">Fortsetzen</button>
        <button type="button" class="exam__discard tap" @click="discardRun">Verwerfen</button>
      </div>
    </div>

    <template v-else>
      <button type="button" class="exam__start tap" :disabled="!ready || exam.parts.value.length === 0" @click="begin()">
        Durchgang starten
      </button>

      <details class="exam__repeat">
        <summary>Wiederholung mit gleichem Seed</summary>
        <p>
          Ein Wiederholungslauf zeigt dieselben Aufgaben nochmals. Das misst dann dein Gedächtnis
          und nicht dein Können, deshalb wird ein solcher Lauf markiert und aus den Verläufen
          herausgehalten.
        </p>
        <div class="exam__repeat-row">
          <input
            v-model="repeatSeed"
            class="exam__repeat-input num"
            type="text"
            inputmode="numeric"
            placeholder="Seed"
          />
          <button type="button" class="exam__discard tap" @click="beginRepeat">Wiederholen</button>
        </div>
      </details>
    </template>
  </div>

  <ClientOnly v-else-if="phase === 'running'">
    <div v-if="exam.currentPart.value" class="exam__run">
      <div class="exam__progress shell">
        <span class="eyebrow">
          Teil {{ (exam.state.value?.partIndex ?? 0) + 1 }} von {{ exam.parts.value.length }}
        </span>
        <span class="exam__progress-label">{{ exam.currentPart.value.label }}</span>
      </div>
      <component
        :is="currentComponent"
        v-if="currentComponent"
        :key="exam.currentPart.value.slug"
        :seed="currentSeed"
        :difficulty="gameBySlug(exam.currentPart.value.slug)?.difficultyRange[0] ?? 1"
        @finish="onPartFinish"
      />
    </div>
  </ClientOnly>

  <div v-else class="shell exam">
    <p class="eyebrow">Ergebnis</p>
    <h1 class="exam__title" :class="exam.verdict.value?.passed ? 'is-pass' : 'is-fail'">
      {{ exam.verdict.value?.passed ? 'Bestanden' : 'Nicht bestanden' }}
    </h1>

    <p v-if="!exam.verdict.value?.complete" class="exam__warning">
      <strong>Unvollständiger Lauf.</strong> Es fehlen
      {{ exam.verdict.value?.missingLabels.join(' und ') }}. Das Urteil gilt nur für die Teile, die
      gespielt wurden, und ersetzt keine echte Standortbestimmung.
    </p>

    <ScoreBand :note="exam.verdict.value?.average ?? null" source="thresholds" label="Durchschnitt" :show-source="false" />
    <p class="exam__band-note">Fixe Startschwellen, damit Läufe über Monate vergleichbar bleiben.</p>

    <ul class="card exam__notes">
      <li v-for="result in exam.state.value?.results ?? []" :key="result.slug">
        <span class="exam__note-label">{{ result.construct === 'rechnen' ? 'Rechnerisches Denken' : result.construct === 'logik' ? 'Logisches Denken' : result.construct === 'wortfluss' ? 'Wortflüssigkeit' : result.construct === 'konzentration' ? 'Konzentrationsleistung' : result.construct }}</span>
        <span class="num exam__note-value" :class="result.note >= 4 ? 'is-pass' : 'is-fail'">
          {{ noteText(result.note) }}
        </span>
      </li>
    </ul>

    <ol class="exam__rules">
      <li v-for="rule in exam.verdict.value?.rules ?? []" :key="rule.id" class="card exam__rule" :class="rule.passed ? 'is-pass' : 'is-fail'">
        <span class="exam__rule-mark" aria-hidden="true">{{ rule.passed ? '✓' : '✗' }}</span>
        <span class="exam__rule-label">{{ rule.label }}</span>
        <span class="exam__rule-detail">{{ rule.detail }}</span>
        <span class="sr-only">{{ rule.passed ? 'erfüllt' : 'nicht erfüllt' }}</span>
      </li>
    </ol>

    <p class="exam__meta">
      Gestartet um <span class="num">{{ startedClock }}</span
      >. Seed <span class="num">{{ exam.state.value?.seed }}</span
      >.
      <template v-if="exam.state.value?.repeatedSeed"> Wiederholungslauf, nicht in den Verläufen.</template>
    </p>

    <NuxtLink to="/" class="exam__home tap">Zur Übersicht</NuxtLink>
  </div>
</template>

<style scoped>
.exam {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 100dvh;
  padding-block: 2rem;
  padding-bottom: max(2rem, env(safe-area-inset-bottom));
}

.exam__back {
  align-self: flex-start;
  font-size: 0.875rem;
  color: var(--muted);
  text-decoration: none;
}

.exam__title {
  font-size: 1.875rem;
}

.exam__title.is-pass {
  color: var(--pass);
}

.exam__title.is-fail {
  color: var(--fail);
}

.exam__lead {
  color: var(--muted);
}

.exam__warning {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  font-size: 0.875rem;
  line-height: 1.5;
  background-color: var(--gold-soft);
  border: 1px solid var(--gold);
  border-radius: var(--radius-key);
}

.exam__warning-list {
  font-weight: 600;
}

.exam__parts {
  margin: 0;
  padding: 0.5rem 1rem;
  list-style: none;
}

.exam__parts li {
  display: grid;
  grid-template-columns: 1.5rem 1fr auto;
  gap: 0.5rem;
  align-items: baseline;
  padding-block: 0.5rem;
  border-bottom: 1px solid var(--rule);
}

.exam__parts li:last-child {
  border-bottom: 0;
}

.exam__part-index {
  color: var(--faint);
  font-size: 0.8125rem;
}

.exam__part-label {
  font-weight: 600;
}

.exam__part-game {
  font-size: 0.8125rem;
  color: var(--faint);
}

.exam__clock {
  font-size: 0.875rem;
  color: var(--muted);
}

.exam__resume {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  margin-top: auto;
  font-size: 0.9375rem;
}

.exam__resume-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.exam__start {
  margin-top: auto;
  padding-block: 1rem;
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--accent-ink);
  background-color: var(--accent);
  border-radius: var(--radius-key);
}

.exam__resume .exam__start {
  margin-top: 0;
}

.exam__start:disabled {
  opacity: 0.55;
}

.exam__discard {
  padding-block: 0.875rem;
  font-size: 0.9375rem;
  color: var(--muted);
  border: 1px solid var(--rule);
  border-radius: var(--radius-key);
}

.exam__repeat {
  font-size: 0.8125rem;
  color: var(--muted);
}

.exam__repeat summary {
  padding-block: 0.5rem;
  cursor: pointer;
}

.exam__repeat p {
  padding-block: 0.375rem 0.625rem;
  line-height: 1.5;
}

.exam__repeat-row {
  display: flex;
  gap: 0.5rem;
}

.exam__repeat-input {
  flex: 1;
  min-height: 2.75rem;
  padding-inline: 0.75rem;
  font-size: max(1rem, 16px);
  color: var(--ink);
  background-color: var(--raised);
  border: 1px solid var(--rule);
  border-radius: var(--radius-key);
}

.exam__run {
  min-height: 100dvh;
}

.exam__progress {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding-block: 0.5rem;
}

.exam__progress-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--muted);
}

.exam__notes {
  margin: 0;
  padding: 0.375rem 1rem;
  list-style: none;
}

.exam__notes li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding-block: 0.625rem;
  border-bottom: 1px solid var(--rule);
}

.exam__notes li:last-child {
  border-bottom: 0;
}

.exam__note-value {
  font-size: 1.125rem;
  font-weight: 600;
}

.exam__note-value.is-pass {
  color: var(--pass);
}

.exam__note-value.is-fail {
  color: var(--fail);
}

.exam__band-note {
  margin-top: -0.5rem;
  font-size: 0.75rem;
  color: var(--faint);
}

.exam__rules {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.exam__rule {
  display: grid;
  grid-template-columns: 1.25rem 1fr;
  gap: 0.125rem 0.625rem;
  padding: 0.75rem 1rem;
}

.exam__rule-mark {
  grid-row: span 2;
  font-size: 1rem;
  font-weight: 700;
}

.exam__rule.is-pass {
  border-color: color-mix(in srgb, var(--pass) 45%, var(--rule));
}

.exam__rule.is-pass .exam__rule-mark {
  color: var(--pass);
}

.exam__rule.is-fail {
  border-color: var(--fail);
}

.exam__rule.is-fail .exam__rule-mark {
  color: var(--fail);
}

.exam__rule-label {
  font-size: 0.875rem;
  line-height: 1.4;
}

.exam__rule-detail {
  font-size: 0.75rem;
  color: var(--faint);
}

.exam__meta {
  font-size: 0.75rem;
  color: var(--faint);
}

.exam__home {
  margin-top: auto;
  padding-block: 0.875rem;
  font-size: 0.9375rem;
  text-align: center;
  color: var(--muted);
  text-decoration: none;
}
</style>
