import { expect, test } from '@playwright/test'
import { games } from '../app/games/index'
import { startGame, storedSessions, tapTrailInOrder, waitForResult } from './helpers'

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage()
  for (const game of games) {
    await page.goto(`/play/${game.slug}`, { waitUntil: 'domcontentloaded' }).catch(() => {})
  }
  await page.close()
})

test.describe('catalogue', () => {
  test('lists every registered game and links to it', async ({ page }) => {
    await page.goto('/')
    for (const game of games) {
      await expect(page.getByRole('link', { name: new RegExp(game.name) })).toBeVisible()
    }
  })
})

for (const game of games) {
  test.describe(game.slug, () => {
    test('starts and presents a first item', async ({ page }) => {
      await startGame(page, game.slug, '?dauer=8&items=2')

      await expect(page.locator('.frame__bar')).toBeVisible()
      await expect(page.locator('.frame__progress')).toBeVisible()

      const interactive = page.locator('.frame button:not([disabled]), .frame input')
      await expect(interactive.first()).toBeVisible({ timeout: 15_000 })
    })

    test('reaches a stored result', async ({ page }) => {
      const before = await storedSessions(page, game.slug)
      await startGame(page, game.slug, '?dauer=6&items=1')

      const usesTrail = (await page.locator('.frame button.node').count()) > 0

      const deadline = Date.now() + 60_000
      while (Date.now() < deadline) {
        if (await page.locator('.scoreband').isVisible().catch(() => false)) break

        if (usesTrail) {
          const tapped = await tapTrailInOrder(page)
          await page.waitForTimeout(tapped > 0 ? 500 : 200)
          continue
        }

        const keys = page.locator('.frame button:not([disabled])')
        const count = await keys.count()
        if (count > 0) await keys.nth(count - 1).click({ timeout: 2000 }).catch(() => {})
        await page.waitForTimeout(300)
      }

      await waitForResult(page)
      await expect.poll(() => storedSessions(page, game.slug), { timeout: 15_000 }).toBe(before + 1)
    })
  })
}
