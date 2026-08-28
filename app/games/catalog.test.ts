import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONSTRUCT_ORDER, games, gamesBySlug } from './index'

const GAMES_DIR = join(process.cwd(), 'app', 'games')

function folderSlugs(): string[] {
  return readdirSync(GAMES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(join(GAMES_DIR, name, 'definition.ts')))
    .sort()
}

describe('game catalog', () => {
  it('registers every game folder in index.ts', () => {
    const registered = games.map((game) => game.slug).sort()
    expect(registered).toEqual(folderSlugs())
  })

  it('ships a Play component and a test for every registered game', () => {
    for (const game of games) {
      expect(existsSync(join(GAMES_DIR, game.slug, 'Play.vue')), `${game.slug}/Play.vue`).toBe(true)
      expect(
        existsSync(join(GAMES_DIR, game.slug, 'generator.test.ts')),
        `${game.slug}/generator.test.ts`,
      ).toBe(true)
    }
  })

  it('uses unique slugs', () => {
    expect(gamesBySlug.size).toBe(games.length)
  })

  it('gives every game a sane definition', () => {
    for (const game of games) {
      expect(game.slug, 'slug must be kebab safe').toMatch(/^[a-z][a-z0-9-]*$/)
      expect(game.name.length).toBeGreaterThan(0)
      expect(game.blurb.length).toBeGreaterThan(0)
      expect(CONSTRUCT_ORDER).toContain(game.construct)
      expect(game.difficultyRange[0]).toBeLessThan(game.difficultyRange[1])
      expect(game.defaultDurationS).toBeGreaterThan(0)
      expect(game.thresholds.raw1).toBeLessThan(game.thresholds.raw4)
      expect(game.thresholds.raw4).toBeLessThan(game.thresholds.raw6)
      expect(game.weight(game.difficultyRange[1])).toBeGreaterThan(game.weight(game.difficultyRange[0]))
      if (game.mode === 'block') expect(game.itemCount).toBeGreaterThan(0)
    }
  })
})
