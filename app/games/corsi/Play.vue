<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { GameFinishPayload } from '~/composables/useGameSession'
import type { BlockSpot, CorsiPayload } from './generator'
import { BLOCKS, BLOCK_RATIO, BOARD_ASPECT } from './generator'
import definition from './definition'

const props = defineProps<{ seed: number; difficulty: number; durationS?: number }>()
const emit = defineEmits<{ finish: [GameFinishPayload] }>()

const engine = useEngine({
  definition,
  seed: props.seed,
  startDifficulty: props.difficulty,
  durationS: props.durationS,
  feedbackMs: 1400,
})
const { current, feedback } = engine

useGameSession(engine, (payload) => emit('finish', payload))

const taps = ref<number[]>([])
const lit = ref<number | null>(null)
const phase = ref<'zeigen' | 'antworten'>('zeigen')

const task = computed(() => (current.value?.payload ?? null) as CorsiPayload | null)
const locked = computed(() => feedback.value !== null)
const showing = computed(() => task.value !== null && phase.value === 'zeigen' && !locked.value)
const answering = computed(() => task.value !== null && phase.value === 'antworten' && !locked.value)

const solution = computed(() => {
  const expected = feedback.value?.expected
  return Array.isArray(expected) ? (expected as number[]) : []
})

const verdict = computed(() => {
  if (!feedback.value) return null
  return feedback.value.correct
    ? { mark: '✓', text: 'richtig nachgetippt' }
    : { mark: '✗', text: 'daneben, die Reihenfolge steht auf den Feldern' }
})

const boardStyle = computed(() => ({ aspectRatio: `1 / ${BOARD_ASPECT}` }))

function blockStyle(spot: BlockSpot) {
  return {
    left: `${spot.x * 100}%`,
    top: `${spot.y * 100}%`,
    width: `${BLOCK_RATIO * 100}%`,
  }
}

function badgeOf(index: number): string {
  if (locked.value) {
    const position = solution.value.indexOf(index)
    return position >= 0 ? String(position + 1) : ''
  }
  const hits: number[] = []
  taps.value.forEach((entry, position) => {
    if (entry === index) hits.push(position + 1)
  })
  return hits.join('·')
}

function stateOf(index: number): string {
  if (locked.value) return solution.value.includes(index) ? 'is-answer' : ''
  if (showing.value && lit.value === index) return 'is-lit'
  if (taps.value.includes(index)) return 'is-tapped'
  return ''
}

function labelOf(index: number): string {
  const badge = badgeOf(index)
  if (!badge) return `Feld ${index + 1}`
  return locked.value
    ? `Feld ${index + 1}, richtige Position ${badge}`
    : `Feld ${index + 1}, getippt als Nummer ${badge}`
}

let rafHandle = 0
let startedAt = 0
let sessionStart = 0

function clock(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function tap(index: number) {
  const item = task.value
  if (!item || !answering.value) return
  const next = [...taps.value, index]
  taps.value = next
  if (next.length >= item.length) engine.submit(next)
}

function onBlockKeydown(event: KeyboardEvent, index: number) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  if (event.metaKey || event.ctrlKey || event.altKey) return
  event.preventDefault()
  if (event.repeat) return
  tap(index)
}

function frame() {
  rafHandle = requestAnimationFrame(frame)
  if (engine.status.value === 'running' && clock() - sessionStart >= engine.durationS * 1000) {
    engine.finish()
    return
  }

  const item = task.value
  if (!item || phase.value !== 'zeigen' || feedback.value !== null) return

  const elapsed = clock() - startedAt - item.leadMs
  if (elapsed < 0) {
    lit.value = null
    return
  }

  const cycle = item.stepMs + item.gapMs
  const step = Math.floor(elapsed / cycle)
  if (step >= item.length) {
    lit.value = null
    phase.value = 'antworten'
    return
  }

  lit.value = elapsed - step * cycle < item.stepMs ? item.sequence[step]! : null
}

watch(
  current,
  (trial) => {
    taps.value = []
    lit.value = null
    if (!trial) return
    phase.value = 'zeigen'
    startedAt = clock()
  },
  { flush: 'sync' },
)

onMounted(() => {
  sessionStart = clock()
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
      <div class="run__head card">
        <p class="eyebrow">{{ showing ? 'Merken' : 'Nachtippen' }}</p>
        <p class="run__prompt">{{ task?.prompt ?? '' }}</p>
      </div>

      <div class="run__stage">
        <div
          class="board"
          :class="{
            'is-correct': feedback?.correct === true,
            'is-wrong': feedback !== null && feedback.correct === false,
          }"
          :style="boardStyle"
        >
          <button
            v-for="(spot, index) in BLOCKS"
            :key="index"
            type="button"
            class="board__block tap"
            :class="stateOf(index)"
            :style="blockStyle(spot)"
            :disabled="!answering"
            :aria-label="labelOf(index)"
            :aria-pressed="taps.includes(index)"
            @keydown="onBlockKeydown($event, index)"
            @click="tap(index)"
          >
            <span v-if="badgeOf(index)" class="board__badge num">{{ badgeOf(index) }}</span>
          </button>
        </div>
      </div>

      <p class="run__status" role="status">
        <span v-if="verdict">{{ verdict.mark }} {{ verdict.text }}</span>
        <span v-else-if="showing">Folge einprägen</span>
        <span v-else-if="task">{{ taps.length }} von {{ task.length }} getippt</span>
        <span v-else>&nbsp;</span>
      </p>
    </div>
  </GameFrame>
</template>

<style scoped>
.run {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.75rem;
}

.run__head {
  padding: 0.625rem 0.875rem;
  text-align: center;
}

.run__prompt {
  font-size: 1.0625rem;
  font-weight: 500;
  line-height: 1.3;
}

.run__stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 16rem;
}

.board {
  position: relative;
  width: 100%;
  max-width: 22rem;
  border: 1px solid transparent;
  border-radius: var(--radius-card);
  transition: border-color 120ms ease;
}

.board.is-correct {
  border-color: var(--pass);
}

.board.is-wrong {
  border-color: var(--fail);
}

.board__block {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  padding: 0;
  color: var(--muted);
  background-color: var(--raised);
  border: 2px solid var(--rule);
  border-radius: var(--radius-key);
  box-shadow: var(--shadow-key);
  transform: translate(-50%, -50%);
  transition: background-color 90ms ease, border-color 90ms ease, color 90ms ease;
}

.board__block:disabled {
  cursor: default;
}

.board__block.is-lit {
  color: var(--accent-ink);
  background-color: var(--accent);
  border-color: var(--accent);
}

.board__block.is-tapped {
  color: var(--accent);
  background-color: var(--accent-soft);
  border-color: var(--accent);
}

.board__block.is-answer {
  color: var(--gold);
  background-color: var(--gold-soft);
  border-color: var(--gold);
}

.board__badge {
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1;
}

.run__status {
  min-height: 1.5rem;
  padding-block: 0.25rem;
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
  font-size: 0.875rem;
  text-align: center;
  color: var(--muted);
}
</style>
