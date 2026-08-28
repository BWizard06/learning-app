<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { GameFinishPayload } from '~/composables/useGameSession'
import { negativesAllowed, type SequencePayload } from './generator'
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
const negativeKey = ref(negativesAllowed(props.difficulty))

const task = computed(() => (current.value?.payload ?? null) as SequencePayload | null)
const locked = computed(() => feedback.value !== null)
const expected = computed(() => (feedback.value ? String(feedback.value.expected) : ''))
const spoken = computed(() =>
  task.value ? `${task.value.terms.join(', ')}, wie geht es weiter?` : '',
)

watch(current, () => {
  entry.value = ''
  if (task.value?.allowNegative) negativeKey.value = true
})

function submit() {
  if (locked.value || entry.value === '' || entry.value === '-') return
  const value = Number.parseInt(entry.value, 10)
  if (!Number.isFinite(value)) return
  engine.submit(value)
}

onMounted(() => engine.start())
onBeforeUnmount(() => engine.dispose())
</script>

<template>
  <GameFrame :engine="engine">
    <div class="run">
      <div class="run__task">
        <p class="eyebrow run__eyebrow">Wie geht die Reihe weiter?</p>

        <ol v-if="task" class="run__row" :aria-label="spoken">
          <li v-for="(term, position) in task.terms" :key="position" class="run__cell num">
            {{ term }}
          </li>
          <li
            class="run__cell run__cell--slot num"
            :class="{ 'is-correct': feedback?.correct, 'is-wrong': feedback && !feedback.correct }"
          >
            <span>{{ entry || '?' }}</span>
            <span v-if="feedback" class="run__mark" aria-hidden="true">{{
              feedback.correct ? '✓' : '✗'
            }}</span>
          </li>
        </ol>
      </div>

      <p class="run__hint" role="status">
        <span v-if="feedback && !feedback.correct" class="num">richtig wäre {{ expected }}</span>
        <span v-else-if="feedback">richtig</span>
        <span v-else>&nbsp;</span>
      </p>

      <NumberPad
        v-model="entry"
        :allow-negative="negativeKey"
        :disabled="locked"
        submit-label="Prüfen"
        @submit="submit"
      />
    </div>
  </GameFrame>
</template>

<style scoped>
.run {
  display: flex;
  flex: 1;
  flex-direction: column;
}

.run__task {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 8rem;
  padding-block: 1.25rem 1rem;
}

.run__eyebrow {
  color: var(--faint);
}

.run__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.run__cell {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 2.75rem;
  min-height: 3rem;
  padding-inline: 0.625rem;
  font-size: clamp(1.125rem, 5vw, 1.5rem);
  font-weight: 500;
  color: var(--ink);
  background-color: var(--sunken);
  border: 1px solid var(--rule);
  border-radius: var(--radius-key);
}

.run__cell--slot {
  position: relative;
  font-weight: 700;
  color: var(--accent);
  background-color: var(--accent-soft);
  border-style: dashed;
  border-color: var(--accent);
}

.run__cell--slot.is-correct {
  color: var(--pass);
  border-style: solid;
  border-color: var(--pass);
  background-color: color-mix(in srgb, var(--pass) 12%, var(--raised));
}

.run__cell--slot.is-wrong {
  color: var(--fail);
  border-style: solid;
  border-color: var(--fail);
  background-color: color-mix(in srgb, var(--fail) 12%, var(--raised));
}

.run__mark {
  position: absolute;
  top: -0.5rem;
  right: -0.375rem;
  font-size: 0.9375rem;
  font-weight: 700;
  line-height: 1;
}

.run__hint {
  min-height: 1.5rem;
  padding-block: 0.5rem 0.75rem;
  font-size: 0.875rem;
  text-align: center;
  color: var(--muted);
}
</style>
