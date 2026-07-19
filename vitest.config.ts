import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      // Mirror the tsconfig `@/*` -> project-root mapping so `@/lib/...` imports
      // resolve in tests exactly as they do in the Next build.
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
})
