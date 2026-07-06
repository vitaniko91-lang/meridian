import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    pool: 'threads',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
