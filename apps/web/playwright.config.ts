import { defineConfig } from '@playwright/test';

const PORT = 4319;

export default defineConfig({
  testDir: 'e2e',
  webServer: {
    command: `pnpm build && pnpm preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000
  },
  use: { baseURL: `http://localhost:${PORT}` }
});
