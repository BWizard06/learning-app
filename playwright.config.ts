import { defineConfig, devices } from '@playwright/test'

const PORT = 3210
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    locale: 'de-CH',
    timezoneId: 'Europe/Zurich',
  },
  projects: [{ name: 'mobile', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT} --host 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
    env: { NUXT_DB_PATH: './data/e2e.db' },
  },
})
