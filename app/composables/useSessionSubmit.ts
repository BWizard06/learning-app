import { ref } from 'vue'
import type { Note, SessionPayload } from '~~/shared/types'

export type SubmitState = 'idle' | 'sending' | 'stored' | 'pending' | 'expired'

export function useSessionSubmit() {
  const state = ref<SubmitState>('idle')
  const note = ref<Note | null>(null)
  const error = ref<string | null>(null)

  async function submit(payload: SessionPayload): Promise<void> {
    state.value = 'sending'
    error.value = null
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(payload),
      })

      const contentType = response.headers.get('content-type') ?? ''
      if (!response.ok || !contentType.includes('application/json')) {
        state.value = response.status === 401 || response.status === 403 ? 'expired' : 'pending'
        error.value = `Antwort ${response.status}`
        return
      }

      const body = (await response.json()) as { note: Note | null }
      note.value = body.note
      state.value = 'stored'
    } catch (cause) {
      state.value = 'pending'
      error.value = cause instanceof Error ? cause.message : 'Netzwerkfehler'
    }
  }

  return { state, note, error, submit }
}
