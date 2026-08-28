import type { Construct, GameDefinition } from '~~/shared/types'
import kopfrechnen from './kopfrechnen/definition'
import rechenzeichen from './rechenzeichen/definition'
import zahlenreihen from './zahlenreihen/definition'
import matrizen from './matrizen/definition'
import wortfluss from './wortfluss/definition'
import d2 from './d2/definition'
import symbolzahl from './symbolzahl/definition'
import stroop from './stroop/definition'
import zeichenvergleich from './zeichenvergleich/definition'
import gonogo from './gonogo/definition'
import trailmaking from './trailmaking/definition'

export const CONSTRUCT_ORDER: Construct[] = [
  'rechnen',
  'logik',
  'sprache',
  'wortfluss',
  'konzentration',
  'gedaechtnis',
  'text',
]

export const games: GameDefinition[] = [kopfrechnen, rechenzeichen, zahlenreihen, matrizen, wortfluss, d2, symbolzahl, stroop, zeichenvergleich, gonogo, trailmaking].sort((a, b) => {
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
