import { defineConfig } from '@playwright/test'

const baseURL = process.env.PVE_DEV_URL ?? 'http://localhost:3000'

export default defineConfig({
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  retries: process.env.CI ? 2 : 0,
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  // Next dev compiles routes on demand; first hits can be slow, especially in CI
  timeout: 90_000,
  use: {
    actionTimeout: 15_000,
    baseURL,
    navigationTimeout: 60_000,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm --filter dev dev',
    cwd: '..',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    url: baseURL,
  },
})
