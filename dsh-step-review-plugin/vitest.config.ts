import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import { standardDecoratorPlugin } from '../vitest.shared.ts'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

export default defineConfig({
  root: repoRoot,
  plugins: [
    tsconfigPaths({
      projects: [fileURLToPath(new URL('../tsconfig.base.json', import.meta.url))],
    }),
    standardDecoratorPlugin(),
  ],
  test: {
    include: ['dsh-step-review-plugin/tests/**/*.spec.ts'],
  },
})
