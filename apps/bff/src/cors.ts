export const DEFAULT_WEB_ORIGIN = 'http://localhost:3000';

/**
 * Render carga WEB_ORIGIN como una única variable de entorno. Aceptamos una
 * lista separada por comas para que una preview pueda compartir el BFF con el
 * frontend principal sin abrir CORS a cualquier origen.
 */
export function resolveWebOrigins(value: string | undefined): string | string[] {
  const origins = (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) return DEFAULT_WEB_ORIGIN;
  if (origins.length === 1) return origins[0]!;
  return origins;
}
