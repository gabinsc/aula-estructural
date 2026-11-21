import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: '/aula-estructural/',
  plugins: [react()],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
