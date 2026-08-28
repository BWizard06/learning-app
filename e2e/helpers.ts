import { expect, type Page } from '@playwright/test'

export async function startGame(page: Page, slug: string, query = ''): Promise<void> {
  await page.goto(`/play/${slug}${query}`)
  const start = page.getByRole('button', { name: 'Starten' })
  await expect(start).toBeEnabled({ timeout: 20_000 })
  await start.click()
  await expect(page.locator('.frame')).toBeVisible({ timeout: 20_000 })
}

export async function waitForResult(page: Page): Promise<void> {
  await expect(page.locator('.scoreband')).toBeVisible({ timeout: 40_000 })
}

export async function storedSessions(page: Page, slug: string): Promise<number> {
  const response = await page.request.get(`/api/sessions?game=${slug}&limit=500`)
  expect(response.ok()).toBe(true)
  const rows = (await response.json()) as unknown[]
  return rows.length
}
