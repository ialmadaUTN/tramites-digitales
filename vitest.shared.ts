/**
 * Configuración de cobertura compartida por los paquetes del monorepo.
 *
 * No importa nada de `vitest`: este archivo vive en la raíz, donde pnpm no
 * expone las dependencias de los paquetes. El objeto que devuelve se valida
 * igual contra los tipos reales en cada `vitest.config.ts` que lo usa.
 */

type Threshold = {
  statements?: number;
  branches?: number;
  functions?: number;
  lines?: number;
};

/** Umbrales globales y, opcionalmente, por glob de rutas. */
export type CoverageThresholds = Threshold & Record<string, Threshold | number | undefined>;

/**
 * Archivos sin comportamiento propio que testear. Contarlos solo diluye el
 * porcentaje: no hay test que los cubra sin volverse un test del framework.
 */
const NO_BEHAVIOUR = [
  'src/**/*.test.{ts,tsx}',
  'src/**/*.d.ts',
  // Tipos generados por `supabase gen types`: se regeneran, no se testean.
  'src/database.types.ts',
  // Tipos y contratos de props sin lógica en runtime.
  'src/**/types.ts',
  'src/shared/types/**',
  // Bootstrap y wiring del framework.
  'src/main.ts',
  'src/main.tsx',
  'src/app.module.ts',
  'src/app/**',
];

/**
 * `all: true` es lo que hace que el número signifique algo: sin eso, v8 solo
 * reporta los archivos que algún test importó, así que un paquete con un único
 * test sobre un archivo trivial muestra 100 % y otro con muchos tests muestra
 * menos. Con el denominador completo, sumar tests nunca empeora el número.
 */
export function coverage(thresholds: CoverageThresholds, extraExcludes: string[] = []) {
  return {
    provider: 'v8' as const,
    all: true,
    include: ['src/**/*.{ts,tsx}'],
    exclude: [...NO_BEHAVIOUR, ...extraExcludes],
    reporter: ['text-summary', 'text', 'json-summary'],
    thresholds,
  };
}
