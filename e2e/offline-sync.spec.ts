import { expect, test } from '@playwright/test'
import { startGame, storedSessions, waitForResult } from './helpers'

const SLUG = 'kopfrechnen'

test('a session finished offline is stored once the connection returns', async ({ page, context }) => {
  await page.goto('/')
  const before = await storedSessions(page, SLUG)

  await context.setOffline(true)

  await startGame(page, SLUG, '?dauer=5')
  await waitForResult(page)

  await expect(page.locator('.banner')).toBeVisible({ timeout: 15_000 })
  expect(await storedSessions(page, SLUG).catch(() => before)).toBe(before)

  await context.setOffline(false)
  await page.locator('.banner').click()

  await expect.poll(() => storedSessions(page, SLUG), { timeout: 20_000 }).toBe(before + 1)
  await expect(page.locator('.banner')).toBeHidden({ timeout: 15_000 })
})

test('sending the same session twice stores it only once', async ({ page }) => {
  await page.goto('/')
  const before = await storedSessions(page, SLUG)

  const payload = {
    id: crypto.randomUUID(),
    gameSlug: SLUG,
    startedAt: Date.now() - 60_000,
    finishedAt: Date.now(),
    durationMs: 60_000,
    difficulty: 4,
    rawScore: 12,
    accuracy: 0.8,
    seed: 999,
    mode: 'sprint',
    deviceId: crypto.randomUUID(),
    metrics: {},
    trials: [],
  }

  const first = await page.request.post('/api/sessions', { data: payload })
  const second = await page.request.post('/api/sessions', { data: payload })

  expect(first.status()).toBe(201)
  expect(second.status()).toBe(200)
  expect((await second.json()).created).toBe(false)
  expect(await storedSessions(page, SLUG)).toBe(before + 1)
})
