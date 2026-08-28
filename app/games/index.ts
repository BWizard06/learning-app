import type { Construct, GameDefinition } from '~~/shared/types'
import kopfrechnen from './kopfrechnen/definition'

export const CONSTRUCT_ORDER: Construct[] = [
  'rechnen',
  'logik',
  'sprache',
  'wortfluss',
  'konzentration',
  'gedaechtnis',
  'text',
]

export const games: GameDefinition[] = [kopfrechnen].sort((a, b) => {
  const byConstruct = CONSTRUCT_ORDER.indexOf(a.construct) - CONSTRUCT_ORDER.indexOf(b.construct)
  if (byConstruct !== 0) return byConstruct
  return a.name.localeCompare(b.name, 'de-CH')
})

export const gamesBySlug = new Map(games.map((game) => [game.slug, game]))

export function gameBySlug(slug: string): GameDefinition | undefined {
  return gamesBySlug.get(slug)
}

export function gamesByConstruct(construct: Construct): GameDefinition[] {
  return games.filter((game) => game.construct === construct)
}

export const coveredConstructs: Construct[] = CONSTRUCT_ORDER.filter((construct) =>
  games.some((game) => game.construct === construct),
)
