<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ChoiceOption } from '~~/shared/types'
import type { GameFinishPayload } from '~/composables/useGameSession'
import type { DatenPayload } from './generator'
import definition from './definition'

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

const entry = ref('')
const chosen = ref<number | null>(null)

const task = computed(() => (current.value?.payload ?? null) as DatenPayload | null)
const options = computed<ChoiceOption[]>(() => current.value?.options ?? [])
const waehlbar = computed(() => options.value.length > 0)
const locked = computed(() => feedback.value !== null)
const hit = computed(() => feedback.value?.correct === true)

const revealIndex = computed(() =>
  feedback.value && waehlbar.value ? Number(feedback.value.expected) : null,
)

const loesung = computed(() => {
  if (!feedback.value) return ''
  if (!waehlbar.value) return String(feedback.value.expected)
  return options.value[Number(feedback.value.expected)]?.label ?? ''
})

watch(current, () => {
  entry.value = ''
  chosen.value = null
})

function submit() {
  if (locked.value || entry.value === '') return
  engine.submit(Number.parseInt(entry.value, 10))
}

function choose(index: number) {
  if (locked.value) return
  chosen.value = index
  engine.submit(index)
}

onMounted(() => engine.start())
onBeforeUnmount(() => engine.dispose())
</script>

<template>
  <GameFrame :engine="engine">
    <div class="run" :class="waehlbar ? 'run--wahl' : 'run--zahl'">
      <p class="eyebrow run__eyebrow">{{ task?.titel ?? '' }}</p>

      <div v-if="task" class="run__data card">
        <div v-if="task.chart === 'tabelle'" class="run__sheet">
          <table class="run__table">
            <caption class="sr-only">{{ task.titel }}, Angaben in {{ task.einheit }}</caption>
            <thead>
              <tr>
                <th scope="col">{{ task.spalte }}</th>
                <th scope="col" class="run__cell--right">{{ task.einheit }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="zeile in task.zeilen" :key="zeile.label">
                <th scope="row">{{ zeile.label }}</th>
                <td class="num run__cell--right">{{ zeile.wert }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="run__figure" v-html="task.svg" />
      </div>

      <p v-if="task" class="run__question">{{ task.frage }}</p>

      <div class="run__foot">
        <div
          v-if="!waehlbar"
          class="run__answer"
          :class="{ 'is-correct': hit, 'is-wrong': feedback && !hit }"
        >
          <span class="num run__value">{{ entry || '·' }}</span>
          <span v-if="task?.suffix" class="run__suffix num">{{ task.suffix }}</span>
          <span v-if="feedback" class="run__mark" aria-hidden="true">{{ hit ? '✓' : '✗' }}</span>
        </div>

        <p class="run__hint" role="status">
          <span v-if="feedback && hit">✓ richtig</span>
          <span v-else-if="feedback" class="num">✗ richtig wäre {{ loesung }}</span>
          <span v-else>&nbsp;</span>
        </p>

        <ChoiceGrid
          v-if="waehlbar"
          :options="options"
          :columns="2"
          :disabled="locked"
          :reveal-index="revealIndex"
          :chosen-index="chosen"
          @select="choose"
        />
        <NumberPad v-else v-model="entry" :disabled="locked" submit-label="Prüfen" @submit="submit" />
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

.run__eyebrow {
  padding-block: 0.125rem 0.4375rem;
}

.run__data {
  padding: 0.375rem 0.4375rem 0.25rem;
  color: var(--ink);
}

.run__figure {
  display: block;
}

.run__figure :deep(svg) {
  display: block;
  width: 100%;
  height: auto;
  max-height: 25vh;
}

.run--wahl .run__figure :deep(svg) {
  max-height: 34vh;
}

.run__figure :deep(text) {
  font-family: var(--font-sans);
}

.run__figure :deep(text.wert),
.run__figure :deep(text.tick),
.run__figure :deep(tspan.wert) {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.run__sheet {
  max-height: 25vh;
  overflow-y: auto;
}

.run--wahl .run__sheet {
  max-height: 34vh;
}

.run__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9375rem;
}

.run__table th,
.run__table td {
  padding: 0.375rem 0.5rem;
  text-align: left;
  border-bottom: 1px solid var(--rule);
}

.run__table thead th {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--faint);
}

.run__table tbody th {
  font-weight: 500;
}

.run__table tbody tr:last-child th,
.run__table tbody tr:last-child td {
  border-bottom: 0;
}

.run__cell--right {
  text-align: right;
}

.run__question {
  padding-block: 0.625rem 0.375rem;
  font-size: clamp(1rem, 4.2vw, 1.1875rem);
  font-weight: 500;
  line-height: 1.3;
}

.run__foot {
  margin-top: auto;
}

.run--wahl .run__foot {
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
}

.run__answer {
  position: relative;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.375rem;
  padding-block: 0.375rem;
  border-bottom: 2px solid var(--rule);
  transition: border-color 120ms ease;
}

.run__answer.is-correct {
  border-color: var(--pass);
}

.run__answer.is-wrong {
  border-color: var(--fail);
}

.run__value {
  font-size: 1.875rem;
  font-weight: 600;
  line-height: 1.1;
}

.run__suffix {
  font-size: 1rem;
  color: var(--muted);
}

.run__mark {
  position: absolute;
  right: 0;
  bottom: 0.375rem;
  font-size: 1.375rem;
  font-weight: 700;
}

.run__answer.is-correct .run__mark {
  color: var(--pass);
}

.run__answer.is-wrong .run__mark {
  color: var(--fail);
}

.run__hint {
  min-height: 1.25rem;
  padding-block: 0.3125rem 0.4375rem;
  font-size: 0.8125rem;
  text-align: center;
  color: var(--muted);
}
</style>
