import { defineConfig, devices } from '@playwright/test';

const contextEnv = {
  FORM_CONTEXT_JWT_SECRET: process.env.FORM_CONTEXT_JWT_SECRET ?? 'e2e-context-secret',
  DEMO_INSURANCE_CODE: process.env.DEMO_INSURANCE_CODE ?? '2050',
  WEB_ORIGIN: 'http://localhost:3000,https://tramites-web-preview.onrender.com',
};

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // Todos los specs comparten un único set de servidores de dev y la misma
  // base de Supabase (no hay entornos aislados por worker). En local, con
  // varios cores libres, correr en paralelo no compite lo suficiente para
  // notarse. Los runners de CI tienen bastante menos CPU: ahí, dos specs que
  // levantan el CMS a la vez (p. ej. `authoring-journey` y otro que también
  // compila/edita formularios) terminan compitiendo por el mismo compilador
  // de Next en modo dev, empujando el más pesado de los recorridos —
  // `authoring-journey`, el que más pasos y round-trips de red tiene — fuera
  // de sus timeouts. Correrlos en serie en CI elimina esa contención sin
  // tocar ninguna espera ni timeout de los tests.
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry', ...devices['Desktop Chrome'] },
  webServer: [
    { command: 'pnpm --filter dynamics-mock dev', url: 'http://localhost:3003/health', reuseExistingServer: true },
    { command: 'pnpm --filter form-remote build && pnpm --filter form-remote preview', url: 'http://localhost:3002', reuseExistingServer: true },
    { command: 'pnpm --filter bff dev', url: 'http://localhost:3001/api/v1/forms', reuseExistingServer: true, env: contextEnv },
    { command: 'pnpm --filter web dev', url: 'http://localhost:3000', reuseExistingServer: true, env: contextEnv },
  ],
});
