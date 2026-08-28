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

const NODE_LABEL = /^(\d+|[A-Z])$/

function trailOrder(labels: readonly string[]): string[] {
  const numbers = labels.filter((label) => /^\d+$/.test(label)).sort((a, b) => Number(a) - Number(b))
  const letters = labels.filter((label) => /^[A-Z]$/.test(label)).sort()
  if (letters.length === 0) return numbers

  const order: string[] = []
  for (let i = 0; i < Math.max(numbers.length, letters.length); i++) {
    if (numbers[i] !== undefined) order.push(numbers[i]!)
    if (letters[i] !== undefined) order.push(letters[i]!)
  }
  return order
}

export async function tapTrailInOrder(page: Page): Promise<number> {
  return page.evaluate(
    async ({ pattern }) => {
      const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
      const nodes = () => [...document.querySelectorAll<HTMLButtonElement>('.frame button.node')]
      const labels = nodes()
        .map((node) => node.textContent?.trim() ?? '')
        .filter((label) => new RegExp(pattern).test(label))

      const numbers = labels.filter((l) => /^\d+$/.test(l)).sort((a, b) => Number(a) - Number(b))
      const letters = labels.filter((l) => /^[A-Z]$/.test(l)).sort()
      const order: string[] = []
      if (letters.length === 0) order.push(...numbers)
      else {
        for (let i = 0; i < Math.max(numbers.length, letters.length); i++) {
          if (numbers[i] !== undefined) order.push(numbers[i]!)
          if (letters[i] !== undefined) order.push(letters[i]!)
        }
      }

      let tapped = 0
      for (const label of order) {
        const node = nodes().find((candidate) => candidate.textContent?.trim() === label)
        if (!node) continue
        node.click()
        tapped++
        await wait(90)
      }
      return tapped
    },
    { pattern: NODE_LABEL.source },
  )
}

export { trailOrder }

export async function storedSessions(page: Page, slug: string): Promise<number> {
  const response = await page.request.get(`/api/sessions?game=${slug}&limit=500`)
  expect(response.ok()).toBe(true)
  const rows = (await response.json()) as unknown[]
  return rows.length
}
