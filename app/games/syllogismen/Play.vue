<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { GameFinishPayload } from '~/composables/useGameSession'
import { VERDICTS, VERDICT_LABELS, type SyllogismPayload, type Verdict } from './generator'
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

const chosen = ref<Verdict | null>(null)

const task = computed(() => (current.value?.payload ?? null) as SyllogismPayload | null)
const locked = computed(() => feedback.value !== null)
const expected = computed(() => (feedback.value ? (String(feedback.value.expected) as Verdict) : null))
const expectedLabel = computed(() => (expected.value ? VERDICT_LABELS[expected.value] : ''))

function keyState(verdict: Verdict): 'correct' | 'wrong' | 'idle' {
  if (feedback.value === null) return 'idle'
  if (verdict === expected.value) return 'correct'
  if (verdict === chosen.value) return 'wrong'
  return 'idle'
}

function answer(verdict: Verdict) {
  if (locked.value || current.value === null) return
  chosen.value = verdict
  engine.submit(verdict)
}

function onKeydown(event: KeyboardEvent) {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
  const position = Number.parseInt(event.key, 10)
  if (!Number.isFinite(position) || position < 1 || position > VERDICTS.length) return
  answer(VERDICTS[position - 1]!)
  event.preventDefault()
}

watch(current, () => {
  chosen.value = null
})

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  engine.start()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  engine.dispose()
})
</script>

<template>
  <GameFrame :engine="engine">
    <div class="run">
      <p class="eyebrow run__eyebrow">Was gilt für den Schluss?</p>

      <div class="run__stage">
        <div
          v-if="task"
          class="run__card card"
          :class="{
            'is-correct': feedback !== null && feedback.correct,
            'is-wrong': feedback !== null && !feedback.correct,
          }"
        >
          <ol class="run__premises">
            <li v-for="(line, index) in task.premises" :key="index" class="run__premise">
              <span class="num run__count" aria-hidden="true">{{ index + 1 }}</span>
              <span class="run__sentence">{{ line }}</span>
            </li>
          </ol>

          <div class="run__conclusion">
            <p class="eyebrow">Schluss</p>
            <p class="run__sentence run__sentence--strong">{{ task.conclusion }}</p>
          </div>
        </div>
      </div>

      <p class="run__status" role="status">
        <span v-if="feedback === null">&nbsp;</span>
        <span v-else-if="feedback.correct">✓ richtig</span>
        <span v-else>✗ richtig wäre: {{ expectedLabel }}</span>
      </p>

      <p class="run__note">Nur die zwei Aussagen zählen, kein Weltwissen.</p>

      <div class="keys">
        <button
          v-for="(verdict, index) in VERDICTS"
          :key="verdict"
          type="button"
          class="keys__key tap"
          :class="`is-${keyState(verdict)}`"
          :disabled="locked"
          @click="answer(verdict)"
        >
          <span class="keys__hint num" aria-hidden="true">{{ index + 1 }}</span>
          <span class="keys__label">{{ VERDICT_LABELS[verdict] }}</span>
          <span v-if="keyState(verdict) === 'correct'" class="keys__mark" aria-label="richtig">✓</span>
          <span v-else-if="keyState(verdict) === 'wrong'" class="keys__mark" aria-label="falsch">✗</span>
        </button>
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
  padding-bottom: 0.5rem;
}

.run__stage {
  flex: 1;
  display: flex;
  align-items: center;
  min-height: 12rem;
  padding-block: 0.5rem;
}

.run__card {
  width: 100%;
  padding: 1rem 1.125rem 1.125rem;
  transition: border-color 120ms ease;
}

.run__card.is-correct {
  border-color: var(--pass);
}

.run__card.is-wrong {
  border-color: var(--fail);
}

.run__premises {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.run__premise {
  display: flex;
  align-items: baseline;
  gap: 0.625rem;
}

.run__count {
  font-size: 0.75rem;
  color: var(--faint);
}

.run__sentence {
  font-size: clamp(1.0625rem, 4.4vw, 1.25rem);
  line-height: 1.35;
}

.run__sentence--strong {
  font-weight: 600;
}

.run__conclusion {
  margin-top: 0.875rem;
  padding-top: 0.875rem;
  border-top: 1px solid var(--rule);
}

.run__conclusion .eyebrow {
  padding-bottom: 0.25rem;
}

.run__status {
  min-height: 1.75rem;
  padding-block: 0.625rem 0.25rem;
  font-size: 0.875rem;
  text-align: center;
  color: var(--muted);
}

.run__note {
  padding-bottom: 0.75rem;
  font-size: 0.75rem;
  text-align: center;
  color: var(--faint);
}

.keys {
  display: grid;
  gap: 0.5rem;
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
}

.keys__key {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 2.25rem;
  color: var(--ink);
  background-color: var(--raised);
  border: 1px solid var(--rule);
  border-radius: var(--radius-key);
  box-shadow: var(--shadow-key);
  transition: background-color 90ms ease, border-color 90ms ease, transform 90ms ease;
}

.keys__key:active:not(:disabled) {
  transform: translateY(1px);
}

.keys__key:disabled {
  cursor: default;
}

.keys__hint {
  position: absolute;
  top: 0.375rem;
  left: 0.5rem;
  font-size: 0.6875rem;
  color: var(--faint);
}

.keys__label {
  font-size: 1.0625rem;
  font-weight: 500;
}

.keys__mark {
  position: absolute;
  top: 0.375rem;
  right: 0.5rem;
  font-size: 0.9375rem;
  font-weight: 700;
}

.keys__key.is-correct {
  border-color: var(--pass);
  background-color: color-mix(in srgb, var(--pass) 12%, var(--raised));
}

.keys__key.is-correct .keys__mark {
  color: var(--pass);
}

.keys__key.is-wrong {
  border-color: var(--fail);
  background-color: color-mix(in srgb, var(--fail) 12%, var(--raised));
}

.keys__key.is-wrong .keys__mark {
  color: var(--fail);
}
</style>
