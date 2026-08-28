<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    allowNegative?: boolean
    allowDecimal?: boolean
    maxLength?: number
    disabled?: boolean
    submitLabel?: string
  }>(),
  { allowNegative: false, allowDecimal: false, maxLength: 9, disabled: false, submitLabel: 'Weiter' },
)

const emit = defineEmits<{ 'update:modelValue': [string]; submit: [] }>()

const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

function append(character: string) {
  if (props.disabled) return
  const current = props.modelValue
  if (character === '0' && current === '0') return
  if (current.replace('-', '').replace(',', '').length >= props.maxLength) return
  if (character === ',' && current.includes(',')) return
  if (character === ',' && current === '') return emit('update:modelValue', '0,')
  if (current === '0' && character !== ',') return emit('update:modelValue', character)
  if (current === '-0' && character !== ',') return emit('update:modelValue', `-${character}`)
  emit('update:modelValue', current + character)
}

function backspace() {
  if (props.disabled) return
  emit('update:modelValue', props.modelValue.slice(0, -1))
}

function toggleSign() {
  if (props.disabled) return
  emit('update:modelValue', props.modelValue.startsWith('-') ? props.modelValue.slice(1) : `-${props.modelValue}`)
}

function submit() {
  if (props.disabled || props.modelValue === '' || props.modelValue === '-') return
  emit('submit')
}

function onKeydown(event: KeyboardEvent) {
  if (props.disabled) return
  if (event.key >= '0' && event.key <= '9') {
    append(event.key)
    event.preventDefault()
    return
  }
  if (event.key === 'Backspace') {
    backspace()
    event.preventDefault()
    return
  }
  if (event.key === 'Enter') {
    submit()
    event.preventDefault()
    return
  }
  if (props.allowNegative && (event.key === '-' || event.key === '_')) {
    toggleSign()
    event.preventDefault()
    return
  }
  if (props.allowDecimal && (event.key === ',' || event.key === '.')) {
    append(',')
    event.preventDefault()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="pad">
    <button
      v-for="digit in digits"
      :key="digit"
      type="button"
      class="pad__key num tap"
      :disabled="disabled"
      @click="append(digit)"
    >
      {{ digit }}
    </button>

    <button
      v-if="allowNegative"
      type="button"
      class="pad__key pad__key--soft num tap"
      :disabled="disabled"
      aria-label="Vorzeichen wechseln"
      @click="toggleSign"
    >
      ±
    </button>
    <button
      v-else-if="allowDecimal"
      type="button"
      class="pad__key pad__key--soft num tap"
      :disabled="disabled"
      aria-label="Komma"
      @click="append(',')"
    >
      ,
    </button>
    <button
      v-else
      type="button"
      class="pad__key pad__key--soft num tap"
      :disabled="disabled"
      aria-label="Löschen"
      @click="backspace"
    >
      ⌫
    </button>

    <button type="button" class="pad__key num tap" :disabled="disabled" @click="append('0')">0</button>

    <button
      v-if="allowNegative || allowDecimal"
      type="button"
      class="pad__key pad__key--soft num tap"
      :disabled="disabled"
      aria-label="Löschen"
      @click="backspace"
    >
      ⌫
    </button>
    <button
      v-else
      type="button"
      class="pad__key pad__key--accent tap"
      :disabled="disabled || modelValue === '' || modelValue === '-'"
      @click="submit"
    >
      {{ submitLabel }}
    </button>

    <button
      v-if="allowNegative || allowDecimal"
      type="button"
      class="pad__key pad__key--accent pad__key--wide tap"
      :disabled="disabled || modelValue === '' || modelValue === '-'"
      @click="submit"
    >
      {{ submitLabel }}
    </button>
  </div>
</template>

<style scoped>
.pad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
}

.pad__key {
  min-height: 3.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.375rem;
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

.pad__key--soft {
  color: var(--muted);
  background-color: transparent;
  box-shadow: none;
}

.pad__key--accent {
  font-family: var(--font-sans);
  font-size: 1rem;
  font-weight: 600;
  color: var(--accent-ink);
  background-color: var(--accent);
  border-color: var(--accent);
}

.pad__key--wide {
  grid-column: span 3;
}
</style>
