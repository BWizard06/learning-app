<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import type { ChoiceOption } from '~~/shared/types'

const props = withDefaults(
  defineProps<{
    options: ChoiceOption[]
    disabled?: boolean
    revealIndex?: number | null
    chosenIndex?: number | null
    columns?: 1 | 2 | 3
  }>(),
  { disabled: false, revealIndex: null, chosenIndex: null, columns: 2 },
)

const emit = defineEmits<{ select: [number] }>()

const isGraphic = computed(() => props.options.some((option) => Boolean(option.svg)))

function stateOf(index: number): 'correct' | 'wrong' | 'idle' {
  if (props.revealIndex === null) return 'idle'
  if (index === props.revealIndex) return 'correct'
  if (index === props.chosenIndex) return 'wrong'
  return 'idle'
}

function choose(index: number) {
  if (props.disabled) return
  emit('select', index)
}

function onKeydown(event: KeyboardEvent) {
  if (props.disabled || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
  const position = Number.parseInt(event.key, 10)
  if (Number.isFinite(position) && position >= 1 && position <= props.options.length) {
    choose(position - 1)
    event.preventDefault()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="choices" :class="[`choices--cols-${columns}`, { 'choices--graphic': isGraphic }]">
    <button
      v-for="(option, index) in options"
      :key="option.id"
      type="button"
      class="choice tap"
      :class="`is-${stateOf(index)}`"
      :disabled="disabled"
      @click="choose(index)"
    >
      <span class="choice__key num">{{ index + 1 }}</span>
      <span v-if="option.svg" class="choice__svg" v-html="option.svg" />
      <span v-else class="choice__label">{{ option.label }}</span>
      <span v-if="stateOf(index) === 'correct'" class="choice__mark" aria-label="richtig">✓</span>
      <span v-else-if="stateOf(index) === 'wrong'" class="choice__mark" aria-label="falsch">✗</span>
    </button>
  </div>
</template>

<style scoped>
.choices {
  display: grid;
  gap: 0.5rem;
}

.choices--cols-1 {
  grid-template-columns: 1fr;
}

.choices--cols-2 {
  grid-template-columns: repeat(2, 1fr);
}

.choices--cols-3 {
  grid-template-columns: repeat(3, 1fr);
}

.choice {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 3.5rem;
  padding: 0.75rem 2rem;
  text-align: center;
  color: var(--ink);
  background-color: var(--raised);
  border: 1px solid var(--rule);
  border-radius: var(--radius-key);
  box-shadow: var(--shadow-key);
  transition: background-color 90ms ease, border-color 90ms ease, transform 90ms ease;
}

.choices--graphic .choice {
  aspect-ratio: 1;
  padding: 0.5rem;
}

.choice:active:not(:disabled) {
  transform: translateY(1px);
}

.choice:disabled {
  cursor: default;
}

.choice__key {
  position: absolute;
  top: 0.375rem;
  left: 0.5rem;
  font-size: 0.6875rem;
  color: var(--faint);
}

.choice__label {
  font-size: 1.0625rem;
  font-weight: 500;
  line-height: 1.3;
}

.choice__svg {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
}

.choice__svg :deep(svg) {
  width: 100%;
  height: 100%;
  max-height: 7rem;
}

.choice__mark {
  position: absolute;
  top: 0.375rem;
  right: 0.5rem;
  font-size: 0.9375rem;
  font-weight: 700;
}

.choice.is-correct {
  border-color: var(--pass);
  background-color: color-mix(in srgb, var(--pass) 12%, var(--raised));
}

.choice.is-correct .choice__mark {
  color: var(--pass);
}

.choice.is-wrong {
  border-color: var(--fail);
  background-color: color-mix(in srgb, var(--fail) 12%, var(--raised));
}

.choice.is-wrong .choice__mark {
  color: var(--fail);
}
</style>
