import { computed, ref } from 'vue'

export type ThemeChoice = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'learning-app.theme'
const choice = ref<ThemeChoice>('system')
let initialised = false

function apply(value: ThemeChoice): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (value === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', value)
}

export function useTheme() {
  if (!initialised && typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') choice.value = stored
    apply(choice.value)
    initialised = true
  }

  function set(value: ThemeChoice): void {
    choice.value = value
    apply(value)
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, value)
  }

  return { choice: computed(() => choice.value), set }
}
