<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { GameFinishPayload } from '~/composables/useGameSession'
import type { TrailPayload } from './generator'
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

const WRONG_MS = 520

const taps = ref<string[]>([])
const step = ref(0)
const fehler = ref(0)
const wrongId = ref<string | null>(null)
let wrongTimer: ReturnType<typeof setTimeout> | null = null

const field = computed(() => (current.value?.payload ?? null) as TrailPayload | null)
const nodes = computed(() => field.value?.nodes ?? [])
const order = computed<string[]>(() => (current.value?.answer as string[] | undefined) ?? [])
const locked = computed(() => feedback.value !== null)
const done = computed(() => order.value.length > 0 && step.value >= order.value.length)

const visited = computed(() => new Set(order.value.slice(0, step.value)))

const trail = computed(() => {
  const spots = new Map(nodes.value.map((node) => [node.id, node]))
  const parts: string[] = []
  for (const id of order.value.slice(0, step.value)) {
    const node = spots.get(id)
    if (node) parts.push(`${node.x},${node.y}`)
  }
  return parts.join(' ')
})

function stateOf(id: string): 'wrong' | 'done' | 'open' {
  if (wrongId.value === id) return 'wrong'
  return visited.value.has(id) ? 'done' : 'open'
}

function labelOf(label: string, id: string): string {
  const state = stateOf(id)
  if (state === 'wrong') return `${label}, falsch`
  if (state === 'done') return `${label}, verbunden`
  return label
}

function clearWrong() {
  if (wrongTimer) clearTimeout(wrongTimer)
  wrongTimer = null
  wrongId.value = null
}

function tap(id: string) {
  if (locked.value || done.value || order.value.length === 0) return
  taps.value = [...taps.value, id]

  if (id !== order.value[step.value]) {
    fehler.value++
    clearWrong()
    wrongId.value = id
    wrongTimer = setTimeout(() => {
      wrongId.value = null
      wrongTimer = null
    }, WRONG_MS)
    return
  }

  clearWrong()
  step.value++
  if (step.value >= order.value.length) engine.submit(taps.value)
}

watch(current, () => {
  clearWrong()
  taps.value = []
  step.value = 0
  fehler.value = 0
})

onMounted(() => engine.start())

onBeforeUnmount(() => {
  clearWrong()
  engine.dispose()
})
</script>

<template>
  <GameFrame :engine="engine">
    <div class="run">
      <div class="run__head card">
        <p class="eyebrow">{{ field?.titel ?? '' }}</p>
        <p class="run__hint">{{ field?.hinweis ?? '' }}</p>
      </div>

      <div
        v-if="field"
        class="field card"
        role="group"
        :aria-label="`Feld mit ${nodes.length} Kreisen`"
      >
        <svg
          class="field__trail"
          :viewBox="`0 0 ${field.width} ${field.height}`"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline class="field__line" :points="trail" />
        </svg>

        <button
          v-for="node in nodes"
          :key="node.id"
          type="button"
          class="node num tap"
          :class="`is-${stateOf(node.id)}`"
          :style="{ left: `${node.x}%`, top: `${node.y}%` }"
          :disabled="locked"
          :aria-label="labelOf(node.label, node.id)"
          @click="tap(node.id)"
        >
          {{ node.label }}
          <span v-if="stateOf(node.id) === 'wrong'" class="node__mark" aria-hidden="true">✗</span>
        </button>
      </div>

      <p class="run__status num" role="status">
        <span v-if="locked">✓ Feld geschafft</span>
        <span v-else-if="wrongId">✗ Noch nicht dieser Kreis</span>
        <span v-else>{{ step }} von {{ order.length }} verbunden</span>
        <span v-if="fehler > 0" class="run__fehler">{{ fehler }} Fehler</span>
      </p>
    </div>
  </GameFrame>
</template>

<style scoped>
.run {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.875rem;
}

.run__head {
  padding: 0.625rem 0.75rem;
}

.run__hint {
  margin-top: 0.125rem;
  font-size: 0.875rem;
  color: var(--muted);
}

.field {
  position: relative;
  width: 100%;
  max-width: min(100%, 76dvh);
  margin-top: auto;
  margin-inline: auto;
  aspect-ratio: 1;
  background-color: var(--sunken);
}

.field__trail {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.field__line {
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.node {
  position: absolute;
  display: flex;
  width: 14%;
  aspect-ratio: 1;
  align-items: center;
  justify-content: center;
  transform: translate(-50%, -50%);
  font-size: clamp(0.9375rem, 3.4vw, 1.25rem);
  font-weight: 600;
  color: var(--ink);
  background-color: var(--raised);
  border: 2px solid var(--rule);
  border-radius: 50%;
  box-shadow: var(--shadow-key);
  transition: background-color 90ms ease, border-color 90ms ease, color 90ms ease;
}

.node:disabled {
  opacity: 0.6;
}

.node.is-done {
  color: var(--accent-ink);
  background-color: var(--accent);
  border-color: var(--accent);
}

.node.is-wrong {
  color: var(--fail);
  background-color: color-mix(in srgb, var(--fail) 16%, var(--raised));
  border-color: var(--fail);
}

.node__mark {
  position: absolute;
  top: -0.375rem;
  right: -0.25rem;
  font-family: var(--font-sans);
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--fail);
}

.run__status {
  display: flex;
  gap: 0.75rem;
  align-items: baseline;
  justify-content: center;
  min-height: 1.5rem;
  padding-block: 0.75rem;
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
  font-size: 0.8125rem;
  color: var(--muted);
}

.run__fehler {
  color: var(--fail);
}
</style>
