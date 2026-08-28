import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

const root = new URL('./', import.meta.url)

const alias = {
  '~~': fileURLToPath(root),
  '~': fileURLToPath(new URL('./app/', root)),
  '#shared': fileURLToPath(new URL('./shared/', root)),
}

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          environment: 'node',
          include: ['{app,server,shared}/**/*.test.ts'],
          exclude: ['**/*.play.test.ts'],
        },
      },
      {
        plugins: [vue()],
        resolve: { alias },
        test: {
          name: 'play',
          environment: 'happy-dom',
          include: ['app/games/**/*.play.test.ts'],
          testTimeout: 30000,
        },
      },
    ],
  },
})
