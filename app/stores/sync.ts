import { defineStore } from 'pinia'
import { clearOutbox, enqueue, flush, pendingCount } from '~/composables/useOfflineQueue'
import type { Note, SessionPayload } from '~~/shared/types'

export type SyncState = 'idle' | 'syncing' | 'pending' | 'expired'

export const useSyncStore = defineStore('sync', {
  state: () => ({
    state: 'idle' as SyncState,
    queued: 0,
    lastError: null as string | null,
    lastSyncedAt: null as number | null,
    notes: {} as Record<string, Note>,
  }),

  getters: {
    hasPending: (state) => state.queued > 0,
    needsLogin: (state) => state.state === 'expired',
  },

  actions: {
    async refreshCount() {
      this.queued = await pendingCount()
    },

    async submit(payload: SessionPayload) {
      await enqueue(payload)
      await this.refreshCount()
      await this.sync()
      return this.notes[payload.id] ?? null
    },

    noteFor(sessionId: string): Note | null {
      return this.notes[sessionId] ?? null
    },

    async sync() {
      if (this.state === 'syncing') return
      this.state = 'syncing'
      const result = await flush()
      this.queued = result.remaining
      this.lastError = result.lastError
      this.notes = { ...this.notes, ...result.notes }

      if (result.unauthenticated) this.state = 'expired'
      else if (result.remaining > 0) this.state = 'pending'
      else {
        this.state = 'idle'
        this.lastSyncedAt = Date.now()
      }
    },

    async discardQueue() {
      await clearOutbox()
      this.queued = 0
      this.state = 'idle'
      this.lastError = null
    },
  },
})
