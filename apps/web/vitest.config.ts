import { defineConfig } from 'vitest/config';
import { coverage } from '../../vitest.shared';

export default defineConfig({
  test: {
    // Los tests de modelo corren en node; los de interacción declaran
    // `@vitest-environment jsdom` en su propio encabezado.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: coverage(
      {
        // Lógica del editor: pura, barata de testear y es la que decide si un
        // formulario se puede guardar. Misma barra que el contrato.
        'src/features/cms/model/**': { statements: 92, branches: 85, functions: 98, lines: 94 },
        // UI del editor: se cubre con tests de interacción sobre la definición
        // que produce, no línea por línea. El piso es lo ya alcanzado.
        'src/features/cms/ui/**': { statements: 58, branches: 70, functions: 51, lines: 63 },
        // Piso global. `hooks/use-cms-workspace.ts` ya está cubierto: decide
        // cuándo se puede guardar, publicar y pausar, y qué aviso ve el autor.
        statements: 80,
        branches: 78,
        functions: 68,
        lines: 83,
      },
      [
        // Adaptadores sin lógica propia: fetch, federación y config. Su
        // comportamiento real se verifica en los e2e, no con mocks que
        // terminarían testeando al mock.
        'src/features/cms/api/**',
        'src/features/host/**',
        'src/shared/**',
        // Shells de composición y layout: renderizan hijos o delegan en una
        // prop. Lo que hay que verificar de ellos es el recorrido completo,
        // y eso lo cubre el e2e.
        'src/features/cms/ui/cms-app.tsx',
        'src/features/cms/ui/cms-shell.tsx',
        'src/features/cms/ui/form-list.tsx',
        'src/features/cms/ui/workspace-header.tsx',
      ],
    ),
  },
});
