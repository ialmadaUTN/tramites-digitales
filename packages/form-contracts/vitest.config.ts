import { defineConfig } from 'vitest/config';
import { coverage } from '../../vitest.shared';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // El contrato es lógica pura y es la fuente de verdad de todo el sistema:
    // un bug acá corrompe cualquier formulario. Es la barra más alta del repo.
    coverage: coverage({ statements: 90, branches: 85, functions: 95, lines: 90 }),
  },
});
