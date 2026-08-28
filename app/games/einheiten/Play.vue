<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { GameFinishPayload } from '~/composables/useGameSession'
import type { UmrechnenPayload } from './generator'
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

const task = computed(() => (current.value?.payload ?? null) as UmrechnenPayload | null)
const locked = computed(() => feedback.value !== null)
const hit = computed(() => feedback.value?.correct === true)
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
      <p class="eyebrow run__eyebrow">{{ task?.label ?? '' }}</p>

      <div class="run__task">
        <p v-if="task" class="run__text">{{ task.prompt }}</p>
      </div>

      <div class="run__answer" :class="{ 'is-correct': hit, 'is-wrong': feedback && !hit }">
        <span class="num run__value">{{ entry || '·' }}</span>
        <span v-if="task" class="num run__unit">{{ task.suffix }}</span>
        <span v-if="feedback" class="run__mark" aria-hidden="true">{{ hit ? '✓' : '✗' }}</span>
      </div>

      <p class="run__hint" role="status">
        <span v-if="feedback && hit">✓ richtig</span>
        <span v-else-if="feedback" class="num">✗ richtig wäre {{ expected }} {{ task?.suffix }}</span>
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

.run__eyebrow {
  padding-block: 0.25rem 0.5rem;
}

.run__task {
  flex: 1;
  display: flex;
  align-items: flex-start;
  min-height: 6rem;
  padding-block: 1rem;
}

.run__text {
  font-size: clamp(1.375rem, 5.5vw, 1.875rem);
  font-weight: 500;
  letter-spacing: -0.02em;
  line-height: 1.3;
}

.run__answer {
  position: relative;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.5rem;
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

.run__unit {
  font-size: 1.25rem;
  font-weight: 500;
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
  min-height: 1.75rem;
  padding-block: 0.5rem 0.75rem;
  font-size: 0.875rem;
  text-align: center;
  color: var(--muted);
}
</style>
