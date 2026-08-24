import { defineConfig } from 'vitest/config';
import { coverage } from '../../vitest.shared';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // El contrato es lógica pura y es la fuente de verdad de todo el sistema:
    // un bug acá corrompe cualquier formulario. Es la barra más alta del repo.
    coverage: coverage({ statements: 93, branches: 88, functions: 96, lines: 96 }),
  },
});
