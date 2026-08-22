import { defineConfig } from 'vitest/config';
import { coverage } from '../../vitest.shared';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: coverage(
      // Piso = lo ya alcanzado sobre la lógica que queda (registry de
      // tipificación, cliente de Dynamics, disponibilidad y completitud
      // estructural del formulario).
      { statements: 85, branches: 70, functions: 80, lines: 93 },
      [
        // Controllers y servicios que solo orquestan Supabase y HTTP: cubrirlos
        // con mocks termina testeando al mock. El recorrido real es el e2e.
        'src/*.controller.ts',
        'src/forms.service.ts',
        'src/submissions.service.ts',
        'src/uploads.service.ts',
        'src/supabase.service.ts',
      ],
    ),
  },
});
