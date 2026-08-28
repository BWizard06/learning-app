<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { GameFinishPayload } from '~/composables/useGameSession'
import type { D2Char } from './generator'
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

const marked = ref<number[]>([])
const lastRow = ref<{ treffer: number; fehler: number } | null>(null)

const row = computed(() => (current.value?.payload ?? []) as D2Char[])
const locked = computed(() => feedback.value !== null)

const MARK_POSITIONS: Record<number, number[]> = {
  0: [],
  1: [13],
  2: [8, 18],
}

function strichText(count: number): string {
  if (count === 0) return 'keine Striche'
  return count === 1 ? '1 Strich' : `${count} Striche`
}

const glyphs = computed(() =>
  row.value.map((char, index) => ({
    index,
    letter: char.letter,
    above: MARK_POSITIONS[char.above] ?? [],
    below: MARK_POSITIONS[char.below] ?? [],
    label: `${char.letter}, oben ${strichText(char.above)}, unten ${strichText(char.below)}`,
  })),
)

const legend = [
  { above: MARK_POSITIONS[2]!, below: MARK_POSITIONS[0]! },
  { above: MARK_POSITIONS[1]!, below: MARK_POSITIONS[1]! },
  { above: MARK_POSITIONS[0]!, below: MARK_POSITIONS[2]! },
]

function isMarked(index: number): boolean {
  return marked.value.includes(index)
}

function toggle(index: number) {
  if (locked.value) return
  marked.value = isMarked(index)
    ? marked.value.filter((entry) => entry !== index)
    : [...marked.value, index].sort((a, b) => a - b)
}

function finishRow() {
  if (locked.value || !current.value) return
  const targets = new Set((current.value.answer as number[]) ?? [])
  const chosen = marked.value.slice()
  let treffer = 0
  for (const index of chosen) {
    if (targets.has(index)) treffer++
  }
  lastRow.value = { treffer, fehler: chosen.length - treffer + (targets.size - treffer) }
  engine.submit(chosen)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || locked.value) return
  finishRow()
  event.preventDefault()
}

watch(current, () => {
  marked.value = []
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
    <div class="sheet">
      <div class="sheet__rule card">
        <p class="eyebrow">Streiche jedes d mit genau zwei Strichen durch</p>
        <div class="sheet__legend">
          <svg v-for="(sample, i) in legend" :key="i" class="glyph__art" viewBox="0 0 26 52" aria-hidden="true">
            <line v-for="x in sample.above" :key="`a${x}`" class="glyph__mark" :x1="x" y1="4" :x2="x" y2="12" />
            <text class="glyph__letter" x="13" y="34">d</text>
            <line v-for="x in sample.below" :key="`b${x}`" class="glyph__mark" :x1="x" y1="42" :x2="x" y2="50" />
          </svg>
        </div>
      </div>

      <div class="sheet__row">
        <button
          v-for="glyph in glyphs"
          :key="glyph.index"
          type="button"
          class="glyph tap"
          :class="{ 'is-marked': isMarked(glyph.index) }"
          :disabled="locked"
          :aria-pressed="isMarked(glyph.index)"
          :aria-label="glyph.label"
          @click="toggle(glyph.index)"
        >
          <svg class="glyph__art" viewBox="0 0 26 52" aria-hidden="true">
            <line v-for="x in glyph.above" :key="`a${x}`" class="glyph__mark" :x1="x" y1="4" :x2="x" y2="12" />
            <text class="glyph__letter" x="13" y="34">{{ glyph.letter }}</text>
            <line v-for="x in glyph.below" :key="`b${x}`" class="glyph__mark" :x1="x" y1="42" :x2="x" y2="50" />
            <line v-if="isMarked(glyph.index)" class="glyph__strike" x1="2" y1="28.5" x2="24" y2="28.5" />
          </svg>
        </button>
      </div>

      <div class="sheet__foot">
        <p class="sheet__status num" role="status">
          <span v-if="feedback && lastRow">
            {{ lastRow.treffer }} Treffer, {{ lastRow.fehler }} Fehler
          </span>
          <span v-else>{{ marked.length }} durchgestrichen</span>
        </p>

        <button type="button" class="sheet__done tap" :disabled="locked" @click="finishRow">
          Zeile fertig
        </button>
      </div>
    </div>
  </GameFrame>
</template>

<style scoped>
.sheet {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 1rem;
}

.sheet__rule {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
}

.sheet__legend {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
}

.sheet__legend .glyph__art {
  width: 16px;
  height: 32px;
  opacity: 0.85;
}

.sheet__row {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-content: flex-start;
  justify-content: center;
  gap: 0.25rem;
}

.glyph {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  min-height: 60px;
  color: var(--ink);
  background-color: var(--raised);
  border: 1px solid var(--rule);
  border-radius: var(--radius-key);
  transition: background-color 90ms ease, border-color 90ms ease;
}

.glyph:disabled {
  opacity: 0.55;
}

.glyph.is-marked {
  background-color: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent);
}

.glyph__art {
  width: 26px;
  height: 52px;
}

.glyph__letter {
  fill: currentColor;
  font-family: var(--font-mono);
  font-size: 20px;
  font-weight: 500;
  text-anchor: middle;
}

.glyph__mark {
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
}

.glyph__strike {
  stroke: var(--accent);
  stroke-width: 2.6;
  stroke-linecap: round;
}

.sheet__foot {
  position: sticky;
  bottom: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-block: 0.75rem;
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
  background-color: var(--paper);
  border-top: 1px solid var(--rule);
}

.sheet__status {
  min-height: 1.25rem;
  font-size: 0.8125rem;
  text-align: center;
  color: var(--muted);
}

.sheet__done {
  min-height: 3.25rem;
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--accent-ink);
  background-color: var(--accent);
  border: 1px solid var(--accent);
  border-radius: var(--radius-key);
  box-shadow: var(--shadow-key);
}

.sheet__done:disabled {
  opacity: 0.5;
}

.sheet__done:active:not(:disabled) {
  transform: translateY(1px);
}
</style>
