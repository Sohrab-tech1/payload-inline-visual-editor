import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['int/**/*.spec.{ts,tsx}'],
  },
})
