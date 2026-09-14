import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup/global.ts'],
    testTimeout: 15000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '~': path.resolve(import.meta.dirname, './'),
      '@': path.resolve(import.meta.dirname, './'),
    },
  },
})
