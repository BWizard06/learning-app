import { v7 as uuidv7 } from 'uuid'

const STORAGE_KEY = 'learning-app.device-id'

export function useDeviceId(): string {
  if (typeof localStorage === 'undefined') return 'server'
  const existing = localStorage.getItem(STORAGE_KEY)
  if (existing) return existing
  const created = uuidv7()
  localStorage.setItem(STORAGE_KEY, created)
  return created
}

export function newSessionId(): string {
  return uuidv7()
}

export function randomSeed(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return crypto.getRandomValues(new Uint32Array(1))[0]!
  }
  return Math.floor(Math.random() * 0xffffffff)
}
