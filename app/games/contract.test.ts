import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { games } from './index'

const GAMES_DIR = join(process.cwd(), 'app', 'games')

const COMMENT_PATTERN = /(^|[^:"'`\\])\/\/(?!\/)|\/\*|<!--/
const DASH_IN_STRING = /(['"`])[^'"`\n]*[—–][^'"`\n]*\1/
const SHARP_S_IN_STRING = /(['"`])[^'"`\n]*ß[^'"`\n]*\1/
const IMPURE_PATTERN = /\bMath\.random\b|\bDate\.now\b|\bnew Date\b|\bwindow\.|document\./

function read(slug: string, file: string): string {
  return readFileSync(join(GAMES_DIR, slug, file), 'utf8')
}

function sourceLines(text: string): { line: string; index: number }[] {
  return text.split('\n').map((line, index) => ({ line, index: index + 1 }))
}

function commentLines(text: string): string[] {
  return sourceLines(text)
    .filter(({ line }) => COMMENT_PATTERN.test(line) && !/https?:\/\//.test(line))
    .map(({ line, index }) => `${index}: ${line.trim().slice(0, 80)}`)
}

const slugs = games.map((game) => game.slug)

describe('every game keeps the contract', () => {
  it('has at least one game registered', () => {
    expect(slugs.length).toBeGreaterThan(0)
  })

  it.each(slugs)('%s carries no comments in any source file', (slug) => {
    for (const file of ['generator.ts', 'definition.ts', 'Play.vue']) {
      expect(commentLines(read(slug, file)), `${slug}/${file}`).toEqual([])
    }
  })

  it.each(slugs)('%s writes Swiss German in every text the reader sees', (slug) => {
    for (const file of ['generator.ts', 'definition.ts', 'Play.vue']) {
      const text = read(slug, file)
      expect(
        text.match(SHARP_S_IN_STRING)?.[0] ?? null,
        `${slug}/${file} sharp s in a user facing string`,
      ).toBeNull()
      expect(text.match(DASH_IN_STRING)?.[0] ?? null, `${slug}/${file} dash in a string`).toBeNull()
    }
  })

  it.each(slugs)('%s keeps the generator pure', (slug) => {
    for (const file of ['generator.ts', 'definition.ts']) {
      const offending = sourceLines(read(slug, file))
        .filter(({ line }) => IMPURE_PATTERN.test(line))
        .map(({ line, index }) => `${index}: ${line.trim().slice(0, 80)}`)
      expect(offending, `${slug}/${file}`).toEqual([])
    }
  })

  it.each(slugs)('%s renders exactly one status region', (slug) => {
    const play = read(slug, 'Play.vue')
    const roleStatus = play.match(/role="status"/g)?.length ?? 0
    const ariaLive = play.match(/aria-live=/g)?.length ?? 0
    expect(roleStatus + ariaLive, `${slug}/Play.vue live regions`).toBe(1)
  })

  it.each(slugs)('%s guards its own keyboard listener against key repeat', (slug) => {
    const play = read(slug, 'Play.vue')
    if (!/addEventListener\(\s*['"]keydown/.test(play)) return
    expect(play, `${slug}/Play.vue keydown without repeat guard`).toMatch(/event\.repeat/)
  })

  it.each(slugs)('%s never reaches into another game folder', (slug) => {
    for (const file of ['generator.ts', 'definition.ts', 'Play.vue']) {
      const imports = [...read(slug, file).matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!)
      for (const source of imports) {
        const foreign = /(\.\.\/)([a-z0-9-]+)\//.exec(source)
        if (foreign && foreign[2] !== slug) {
          expect.fail(`${slug}/${file} imports from ${source}`)
        }
      }
    }
  })

  it.each(slugs)('%s runs the shared generator contract in its tests', (slug) => {
    const test = read(slug, 'generator.test.ts')
    expect(test, `${slug}/generator.test.ts`).toMatch(/runGeneratorContract\s*\(/)
  })

  it.each(slugs)('%s exposes its play component and its tests', (slug) => {
    for (const file of ['generator.ts', 'definition.ts', 'Play.vue', 'generator.test.ts']) {
      expect(existsSync(join(GAMES_DIR, slug, file)), `${slug}/${file}`).toBe(true)
    }
  })

  it('leaves no orphaned folder behind', () => {
    const folders = readdirSync(GAMES_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
    expect(folders.sort()).toEqual([...slugs].sort())
  })
})
