import { defineConfig } from '@playwright/test'

const port = 4189
const baseURL = `http://127.0.0.1:${port}/aula-estructural/`
const browserName = process.env.AULA_E2E_BROWSER === 'firefox' ? 'firefox' : 'chromium'

export default defineConfig({
  testDir: './tests/e2e',
  reporter: 'list',
  use: {
    baseURL,
    browserName,
    channel: browserName === 'chromium' ? process.env.AULA_E2E_CHANNEL || undefined : undefined,
    viewport: { width: 1920, height: 1080 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
  },
})
