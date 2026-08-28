import { expect, type Page } from '@playwright/test'

export async function startGame(page: Page, slug: string, query = ''): Promise<void> {
  await page.goto(`/play/${slug}${query}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Starten' }).click()
  await expect(page.locator('.frame')).toBeVisible()
}

export async function waitForResult(page: Page): Promise<void> {
  await expect(page.locator('.scoreband')).toBeVisible({ timeout: 30_000 })
}

export async function storedSessions(page: Page, slug: string): Promise<number> {
  const response = await page.request.get(`/api/sessions?game=${slug}&limit=200`)
  expect(response.ok()).toBe(true)
  const rows = (await response.json()) as unknown[]
  return rows.length
}
