import { useSyncStore } from '~/stores/sync'

export default defineNuxtPlugin(() => {
  const sync = useSyncStore()

  void sync.refreshCount().then(() => {
    if (sync.queued > 0) void sync.sync()
  })

  window.addEventListener('online', () => {
    void sync.sync()
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && sync.queued > 0) void sync.sync()
  })
})
