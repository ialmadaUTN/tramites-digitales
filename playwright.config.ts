import { defineConfig, devices } from '@playwright/test';

const contextEnv = {
  FORM_CONTEXT_JWT_SECRET: process.env.FORM_CONTEXT_JWT_SECRET ?? 'e2e-context-secret',
  DEMO_INSURANCE_CODE: process.env.DEMO_INSURANCE_CODE ?? '2050',
};

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry', ...devices['Desktop Chrome'] },
  webServer: [
    { command: 'pnpm --filter dynamics-mock dev', url: 'http://localhost:3003/health', reuseExistingServer: true },
    { command: 'pnpm --filter form-remote build && pnpm --filter form-remote preview', url: 'http://localhost:3002', reuseExistingServer: true },
    { command: 'pnpm --filter bff dev', url: 'http://localhost:3001/api/v1/forms', reuseExistingServer: true, env: contextEnv },
    { command: 'pnpm --filter web dev', url: 'http://localhost:3000', reuseExistingServer: true, env: contextEnv },
  ],
});
