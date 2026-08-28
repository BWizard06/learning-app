<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { GameFinishPayload } from '~/composables/useGameSession'
import type { SpanPayload } from './generator'
import definition from './definition'

const props = defineProps<{ seed: number; difficulty: number; durationS?: number }>()
const emit = defineEmits<{ finish: [GameFinishPayload] }>()

const engine = useEngine({
  definition,
  seed: props.seed,
  startDifficulty: props.difficulty,
  durationS: props.durationS,
  feedbackMs: 700,
})
const { current, feedback } = engine

useGameSession(engine, (payload) => emit('finish', payload))

const entry = ref('')
const cursor = ref(-1)
const lit = ref(false)
const answering = ref(false)

const task = computed(() => (current.value?.payload ?? null) as SpanPayload | null)
const digits = computed(() => task.value?.digits ?? [])
const locked = computed(() => feedback.value !== null)
const expected = computed(() => (feedback.value ? String(feedback.value.expected) : ''))
const shown = computed(() => {
  if (!lit.value || cursor.value < 0) return null
  return digits.value[cursor.value] ?? null
})

let rafHandle = 0
let startedAt = 0

function clock(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function frame() {
  rafHandle = requestAnimationFrame(frame)
  const active = task.value
  if (active === null || answering.value) return

  const step = active.digitMs + active.gapMs
  const elapsed = clock() - startedAt
  const index = Math.floor(elapsed / step)

  if (index >= active.digits.length) {
    cursor.value = -1
    lit.value = false
    answering.value = true
    return
  }

  cursor.value = index
  lit.value = elapsed - index * step < active.digitMs
}

watch(
  current,
  (trial) => {
    entry.value = ''
    cursor.value = -1
    lit.value = false
    answering.value = trial === null
    startedAt = clock()
  },
  { flush: 'sync' },
)

function submit() {
  if (locked.value || !answering.value || entry.value === '') return
  engine.submit(Number.parseInt(entry.value, 10))
}

onMounted(() => {
  engine.start()
  rafHandle = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  if (rafHandle) cancelAnimationFrame(rafHandle)
  engine.dispose()
})
</script>

<template>
  <GameFrame :engine="engine">
    <div class="run">
      <p class="eyebrow run__eyebrow">{{ task?.prompt ?? '' }}</p>

      <div
        class="run__stage card"
        :class="{ 'is-correct': feedback?.correct, 'is-wrong': feedback && !feedback.correct }"
      >
        <span v-if="shown !== null" class="num run__digit">{{ shown }}</span>
        <span v-else-if="!answering" class="run__rest" aria-hidden="true">·</span>
        <span v-else class="num run__entry">{{ entry || '·' }}</span>
        <span v-if="feedback" class="run__mark" aria-hidden="true">{{ feedback.correct ? '✓' : '✗' }}</span>
      </div>

      <div class="run__beads" aria-hidden="true">
        <span
          v-for="position in digits.length"
          :key="position"
          class="run__bead"
          :class="{ 'is-done': answering || position - 1 <= cursor }"
        />
      </div>

      <p class="run__status" role="status">
        <span v-if="feedback && feedback.correct">✓ richtig</span>
        <span v-else-if="feedback">✗ richtig wäre <span class="num">{{ expected }}</span></span>
        <span v-else-if="answering && task">{{ digits.length }} Ziffern, {{ task.hint }}</span>
        <span v-else-if="task && cursor >= 0">
          Ziffer {{ cursor + 1 }} von {{ digits.length }} ist {{ digits[cursor] }}
        </span>
        <span v-else>&nbsp;</span>
      </p>

      <div class="run__foot">
        <NumberPad
          v-if="task && answering"
          v-model="entry"
          :disabled="locked"
          :max-length="Math.max(1, digits.length)"
          submit-label="Prüfen"
          @submit="submit"
        />
        <p v-else-if="task" class="run__wait">Die Tasten erscheinen nach der letzten Ziffer.</p>
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
  min-height: 1.5rem;
  padding-block: 0.25rem 0.75rem;
}

.run__stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: clamp(9rem, 32vh, 14rem);
  padding: 1rem;
  transition: border-color 120ms ease;
}

.run__stage.is-correct {
  border-color: var(--pass);
}

.run__stage.is-wrong {
  border-color: var(--fail);
}

.run__digit {
  font-size: clamp(4.5rem, 26vw, 7rem);
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.03em;
}

.run__rest {
  font-size: 2rem;
  color: var(--faint);
}

.run__entry {
  font-size: clamp(1.75rem, 8vw, 2.75rem);
  font-weight: 600;
  line-height: 1.1;
  text-align: center;
  overflow-wrap: anywhere;
}

.run__mark {
  position: absolute;
  right: 0.875rem;
  bottom: 0.75rem;
  font-size: 1.5rem;
  font-weight: 700;
}

.run__stage.is-correct .run__mark {
  color: var(--pass);
}

.run__stage.is-wrong .run__mark {
  color: var(--fail);
}

.run__beads {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.375rem;
  padding-block: 0.875rem 0.25rem;
}

.run__bead {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background-color: var(--sunken);
  border: 1px solid var(--rule);
  transition: background-color 120ms ease;
}

.run__bead.is-done {
  background-color: var(--accent);
  border-color: var(--accent);
}

.run__status {
  min-height: 1.75rem;
  padding-block: 0.5rem 0.75rem;
  font-size: 0.875rem;
  text-align: center;
  color: var(--muted);
}

.run__foot {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: flex-end;
}

.run__wait {
  padding-block: 1.5rem;
  padding-bottom: max(1.5rem, env(safe-area-inset-bottom));
  font-size: 0.875rem;
  text-align: center;
  color: var(--faint);
}
</style>
