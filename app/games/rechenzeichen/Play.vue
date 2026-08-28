<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { GameFinishPayload } from '~/composables/useGameSession'
import {
  OPERATORS,
  OPERATOR_LABELS,
  OPERATOR_NAMES,
  type Operator,
  type RechenzeichenPayload,
} from './generator'
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

const chosen = ref<Operator[]>([])

const task = computed(() => (current.value?.payload ?? null) as RechenzeichenPayload | null)
const locked = computed(() => feedback.value !== null)
const complete = computed(() => task.value !== null && chosen.value.length === task.value.blanks)
const hit = computed(() => feedback.value?.correct === true)

const keys = OPERATORS.map((op) => ({
  op,
  label: OPERATOR_LABELS[op],
  name: OPERATOR_NAMES[op],
}))

interface Cell {
  key: string
  kind: 'zahl' | 'slot'
  text: string
  active: boolean
}

const cells = computed<Cell[]>(() => {
  const item = task.value
  if (!item) return []
  const list: Cell[] = []
  for (let i = 0; i < item.operands.length; i++) {
    list.push({ key: `n${i}`, kind: 'zahl', text: String(item.operands[i]), active: false })
    if (i >= item.blanks) continue
    const op = chosen.value[i]
    list.push({
      key: `s${i}`,
      kind: 'slot',
      text: op ? OPERATOR_LABELS[op] : '?',
      active: !locked.value && chosen.value.length === i,
    })
  }
  return list
})

const spoken = computed(() => {
  const item = task.value
  if (!item) return ''
  const parts: string[] = []
  for (let i = 0; i < item.operands.length; i++) {
    parts.push(String(item.operands[i]))
    if (i >= item.blanks) continue
    const op = chosen.value[i]
    parts.push(op ? OPERATOR_NAMES[op] : 'Leerstelle')
  }
  return `${parts.join(' ')} ergibt ${item.target}`
})

const solution = computed(() => {
  const item = task.value
  const expected = feedback.value?.expected
  if (!item || !Array.isArray(expected)) return ''
  const parts: string[] = [String(item.operands[0])]
  for (let i = 0; i < expected.length; i++) {
    const op = String(expected[i]) as Operator
    parts.push(OPERATOR_LABELS[op] ?? op)
    parts.push(String(item.operands[i + 1]))
  }
  return `${parts.join(' ')} = ${item.target}`
})

watch(current, () => {
  chosen.value = []
})

function place(op: Operator) {
  if (locked.value || !task.value) return
  if (chosen.value.length >= task.value.blanks) return
  chosen.value = [...chosen.value, op]
}

function clearLast() {
  if (locked.value || chosen.value.length === 0) return
  chosen.value = chosen.value.slice(0, -1)
}

function submit() {
  if (locked.value || !complete.value) return
  engine.submit(chosen.value.map((op) => String(op)))
}

const KEY_MAP: Record<string, Operator> = {
  '+': '+',
  '-': '-',
  '*': '*',
  x: '*',
  X: '*',
  '/': ':',
  ':': ':',
}

function onKeydown(event: KeyboardEvent) {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
  if (locked.value) return
  const op = KEY_MAP[event.key]
  if (op) {
    place(op)
    event.preventDefault()
    return
  }
  if (event.key === 'Backspace') {
    clearLast()
    event.preventDefault()
    return
  }
  if (event.key === 'Enter') {
    submit()
    event.preventDefault()
  }
}

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
      <p class="eyebrow run__eyebrow">Punkt vor Strich</p>

      <div class="run__task">
        <ol
          v-if="task"
          class="run__equation"
          :class="{ 'is-correct': hit, 'is-wrong': feedback && !hit }"
          :aria-label="spoken"
        >
          <li
            v-for="cell in cells"
            :key="cell.key"
            class="run__cell num"
            :class="[`run__cell--${cell.kind}`, { 'is-active': cell.active }]"
          >
            {{ cell.text }}
          </li>
          <li class="run__cell run__cell--ziel num">= {{ task.target }}</li>
        </ol>
      </div>

      <p class="run__hint" role="status">
        <span v-if="feedback && hit">✓ richtig</span>
        <span v-else-if="feedback" class="num">✗ richtig ist {{ solution }}</span>
        <span v-else>&nbsp;</span>
      </p>

      <div class="pad">
        <button
          v-for="key in keys"
          :key="key.op"
          type="button"
          class="pad__key num tap"
          :disabled="locked || complete"
          :aria-label="key.name"
          @click="place(key.op)"
        >
          {{ key.label }}
        </button>

        <button
          type="button"
          class="pad__key pad__key--soft pad__key--half tap"
          :disabled="locked || chosen.length === 0"
          @click="clearLast"
        >
          Löschen
        </button>

        <button
          type="button"
          class="pad__key pad__key--accent pad__key--half tap"
          :disabled="locked || !complete"
          @click="submit"
        >
          Prüfen
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
  padding-block: 0.25rem 0.5rem;
}

.run__task {
  flex: 1;
  display: flex;
  align-items: flex-start;
  min-height: 6rem;
  padding-block: 1rem;
}

.run__equation {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: clamp(1.75rem, 8vw, 2.5rem);
  font-weight: 600;
  line-height: 1.15;
}

.run__cell--slot {
  display: inline-flex;
  min-width: 1.6em;
  justify-content: center;
  padding-bottom: 0.1em;
  color: var(--accent);
  border-bottom: 3px solid var(--rule);
}

.run__cell--slot.is-active {
  border-bottom-color: var(--accent);
}

.run__cell--ziel {
  color: var(--muted);
}

.run__equation.is-correct .run__cell--slot {
  color: var(--pass);
  border-bottom-color: var(--pass);
}

.run__equation.is-wrong .run__cell--slot {
  color: var(--fail);
  border-bottom-color: var(--fail);
}

.run__hint {
  min-height: 2.5rem;
  padding-block: 0.5rem 0.75rem;
  font-size: 0.875rem;
  text-align: center;
  color: var(--muted);
}

.pad {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
}

.pad__key {
  min-height: 3.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 500;
  color: var(--ink);
  background-color: var(--raised);
  border: 1px solid var(--rule);
  border-radius: var(--radius-key);
  box-shadow: var(--shadow-key);
  transition: background-color 90ms ease, transform 90ms ease;
}

.pad__key:active:not(:disabled) {
  transform: translateY(1px);
  background-color: var(--sunken);
}

.pad__key:disabled {
  opacity: 0.4;
}

.pad__key--half {
  grid-column: span 2;
  font-family: var(--font-sans);
  font-size: 1rem;
  font-weight: 600;
}

.pad__key--soft {
  color: var(--muted);
  background-color: transparent;
  box-shadow: none;
}

.pad__key--accent {
  color: var(--accent-ink);
  background-color: var(--accent);
  border-color: var(--accent);
}
</style>
