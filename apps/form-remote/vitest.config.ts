import { defineConfig } from 'vitest/config';
import { coverage } from '../../vitest.shared';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: coverage(
      // Piso = lo ya alcanzado (ratchet): impide retroceder sin fingir una
      // meta. El hueco grande es `use-runtime-form` + `dynamic-field` +
      // `dynamic-repeater`, que es la próxima tanda de tests de interacción.
      { statements: 61, branches: 53, functions: 57, lines: 63 },
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
