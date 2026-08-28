<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { GameFinishPayload } from '~/composables/useGameSession'
import type { ArithmeticPayload } from './generator'
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

const task = computed(() => (current.value?.payload ?? null) as ArithmeticPayload | null)
const locked = computed(() => feedback.value !== null)
const expected = computed(() => (feedback.value ? String(feedback.value.expected) : ''))

watch(current, () => {
  entry.value = ''
})

function submit() {
  if (locked.value || entry.value === '') return
  engine.submit(Number.parseInt(entry.value, 10))
}

onMounted(() => engine.start())
onBeforeUnmount(() => engine.dispose())
</script>

<template>
  <GameFrame :engine="engine">
    <div class="run">
      <div class="run__task">
        <p v-if="task" class="run__text">{{ task.text }}</p>
      </div>

      <div class="run__answer" :class="{ 'is-correct': feedback?.correct, 'is-wrong': feedback && !feedback.correct }">
        <span class="num run__value">{{ entry || '·' }}</span>
        <span v-if="task?.suffix" class="run__suffix num">{{ task.suffix }}</span>
        <span v-if="feedback" class="run__mark" aria-hidden="true">{{ feedback.correct ? '✓' : '✗' }}</span>
      </div>

      <p class="run__hint" role="status">
        <span v-if="feedback && !feedback.correct" class="num">richtig wäre {{ expected }}</span>
        <span v-else-if="feedback">richtig</span>
        <span v-else>&nbsp;</span>
      </p>

      <NumberPad v-model="entry" :disabled="locked" submit-label="Prüfen" @submit="submit" />
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
  align-items: flex-start;
  min-height: 6rem;
  padding-block: 1.5rem 1rem;
}

.run__text {
  font-size: clamp(1.5rem, 6vw, 2rem);
  font-weight: 500;
  letter-spacing: -0.02em;
  line-height: 1.25;
}

.run__answer {
  position: relative;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.375rem;
  padding-block: 0.75rem;
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
  font-size: 2.5rem;
  font-weight: 600;
  line-height: 1;
}

.run__suffix {
  font-size: 1.125rem;
  color: var(--muted);
}

.run__mark {
  position: absolute;
  right: 0;
  bottom: 0.75rem;
  font-size: 1.5rem;
  font-weight: 700;
}

.run__answer.is-correct .run__mark {
  color: var(--pass);
}

.run__answer.is-wrong .run__mark {
  color: var(--fail);
}

.run__hint {
  min-height: 1.5rem;
  padding-block: 0.5rem 0.75rem;
  font-size: 0.875rem;
  text-align: center;
  color: var(--muted);
}
</style>
