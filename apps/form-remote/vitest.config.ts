import { defineConfig } from 'vitest/config';
import { coverage } from '../../vitest.shared';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: coverage(
      // Piso = lo ya alcanzado (ratchet): impide retroceder sin fingir una
      // meta. `use-runtime-form` ya tiene tests (carga, pausa y error de
      // envío); lo que sigue abierto es `dynamic-field` + `dynamic-repeater`.
      { statements: 48, branches: 31, functions: 48, lines: 50 },
      [
        // Adaptadores de red y de Supabase: sin lógica propia, se verifican en
        // los e2e contra los servicios reales.
        'src/features/runtime/api/**',
        'src/shared/lib/**',
        'src/DynamicForm.tsx',
      ],
    ),
  },
});
