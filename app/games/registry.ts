import type { Component } from 'vue'

const playModules = import.meta.glob<{ default: Component }>('./*/Play.vue')

function slugFromPath(path: string): string {
  return path.split('/')[1] ?? ''
}

export function playComponentLoader(slug: string): (() => Promise<{ default: Component }>) | null {
  const entry = Object.entries(playModules).find(([path]) => slugFromPath(path) === slug)
  return entry ? entry[1] : null
}

export * from './index'
