<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { Engine } from '~/composables/useEngine'
import type { GameFinishPayload } from '~/composables/useGameSession'
import type { RejectReason, WortflussTrial } from './generator'
import { validateWord } from './generator'
import definition from './definition'

const props = defineProps<{ seed: number; difficulty: number; durationS?: number }>()
const emit = defineEmits<{ finish: [GameFinishPayload] }>()

const engine = useEngine({
  definition,
  seed: props.seed,
  startDifficulty: props.difficulty,
  durationS: props.durationS,
  feedbackMs: 0,
})
const { current, status } = engine

const prompt = shallowRef<WortflussTrial | null>(null)
const rejected = ref(0)

useGameSession(engine, (payload) =>
  emit('finish', {
    ...payload,
    metrics: { ...payload.metrics, rejected: rejected.value },
  }),
)

const frameEngine = {
  ...engine,
  difficulty: computed(() => prompt.value?.difficulty ?? props.difficulty),
} as Engine

const words = ref<{ word: string; key: string }[]>([])
const entry = ref('')
const reason = ref<RejectReason | null>(null)
const field = ref<HTMLInputElement | null>(null)

const letter = computed(() => prompt.value?.payload.letter ?? null)
const category = computed(() => prompt.value?.payload.category ?? null)
const letterUpper = computed(() => (letter.value ? letter.value.toUpperCase() : ''))
const promptText = computed(() => prompt.value?.payload.prompt ?? '')

const locked = computed(() => status.value !== 'running')
const recent = computed(() => words.value.slice().reverse())

const reasonText = computed(() => {
  switch (reason.value) {
    case 'zeichen':
      return 'Nur Buchstaben und Bindestrich'
    case 'kurz':
      return 'Mindestens drei Buchstaben'
    case 'buchstabe':
      return `Muss mit ${letterUpper.value} beginnen`
    case 'doppelt':
      return 'Das Wort steht schon in der Liste'
    default:
      return ''
  }
})

watch(entry, () => {
  if (reason.value !== null) reason.value = null
})

function keepPrompt() {
  if (prompt.value === null) return
  if (current.value !== null && current.value !== prompt.value) current.value = prompt.value
}

function accept() {
  if (locked.value) return

  const check = validateWord(
    entry.value,
    letter.value,
    words.value.map((item) => item.key),
  )

  if (!check.ok) {
    if (check.reason !== 'leer') {
      reason.value = check.reason
      rejected.value += 1
    }
    field.value?.focus()
    return
  }

  keepPrompt()
  words.value = [...words.value, { word: check.word, key: check.key }]
  reason.value = null
  entry.value = ''
  engine.submit(check.word)
  field.value?.focus()
}

onMounted(() => {
  engine.start()
  prompt.value = current.value as WortflussTrial | null
  field.value?.focus()
})

onBeforeUnmount(() => engine.dispose())
</script>

<template>
  <GameFrame :engine="frameEngine">
    <div class="flow">
      <section class="card flow__prompt">
        <p class="eyebrow">Aufgabe</p>
        <div class="flow__line">
          <h1 class="flow__text">{{ promptText }}</h1>
          <span v-if="letter" class="num flow__letter" aria-hidden="true">{{ letterUpper }}</span>
        </div>
        <p v-if="category" class="flow__note">
          Die Kategorie wird nicht automatisch geprüft, das bleibt deine Ehrensache.
        </p>
      </section>

      <div class="flow__count">
        <span class="num flow__number">{{ words.length }}</span>
        <span class="flow__unit">{{ words.length === 1 ? 'Wort' : 'Wörter' }}</span>
      </div>

      <p v-if="words.length === 0" class="flow__empty">Noch nichts eingegeben.</p>
      <ul v-else class="flow__list" aria-label="Angenommene Wörter">
        <li
          v-for="(item, index) in recent"
          :key="item.key"
          class="flow__word"
          :class="{ 'is-fresh': index === 0 }"
        >
          {{ item.word }}
        </li>
      </ul>

      <p class="flow__reason" role="status">
        <template v-if="reasonText">
          <span aria-hidden="true">✗</span>
          <span>{{ reasonText }}</span>
        </template>
        <span v-else>&nbsp;</span>
      </p>

      <form class="flow__form" @submit.prevent="accept">
        <input
          ref="field"
          v-model="entry"
          type="text"
          inputmode="text"
          autocapitalize="off"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
          enterkeyhint="done"
          maxlength="32"
          class="flow__input"
          aria-label="Wort eingeben"
          :disabled="locked"
        >
        <button type="submit" class="flow__submit tap" :disabled="locked || entry.trim() === ''">
          Weiter
        </button>
      </form>
    </div>
  </GameFrame>
</template>

<style scoped>
.flow {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 0;
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
}

.flow__prompt {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.875rem 1rem;
}

.flow__line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.flow__text {
  font-size: clamp(1.25rem, 5.5vw, 1.625rem);
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.flow__letter {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--accent);
  background-color: var(--accent-soft);
  border-radius: var(--radius-key);
}

.flow__note {
  font-size: 0.8125rem;
  line-height: 1.4;
  color: var(--muted);
}

.flow__count {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding-inline: 0.125rem;
}

.flow__number {
  font-size: 2.75rem;
  font-weight: 600;
  line-height: 1;
}

.flow__unit {
  font-size: 0.875rem;
  color: var(--muted);
}

.flow__empty {
  flex: 1;
  min-height: 3rem;
  font-size: 0.875rem;
  color: var(--faint);
}

.flow__list {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 0.375rem;
  min-height: 3rem;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.flow__word {
  padding: 0.25rem 0.625rem;
  font-size: 0.9375rem;
  line-height: 1.4;
  background-color: var(--raised);
  border: 1px solid var(--rule);
  border-radius: 999px;
}

.flow__word.is-fresh {
  color: var(--accent);
  background-color: var(--accent-soft);
  border-color: var(--accent);
}

.flow__reason {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 1.375rem;
  font-size: 0.8125rem;
  color: var(--fail);
}

.flow__form {
  display: flex;
  gap: 0.5rem;
}

.flow__input {
  flex: 1;
  min-width: 0;
  min-height: 3.25rem;
  padding-inline: 0.875rem;
  font-size: max(1.0625rem, 16px);
  color: var(--ink);
  background-color: var(--raised);
  border: 1px solid var(--rule);
  border-radius: var(--radius-key);
  box-shadow: var(--shadow-key);
}

.flow__input:disabled {
  opacity: 0.5;
}

.flow__submit {
  padding-inline: 1.25rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--accent-ink);
  background-color: var(--accent);
  border: 1px solid var(--accent);
  border-radius: var(--radius-key);
  transition: opacity 90ms ease, transform 90ms ease;
}

.flow__submit:active:not(:disabled) {
  transform: translateY(1px);
}

.flow__submit:disabled {
  opacity: 0.4;
}
</style>
