export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

export function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/** Los errores del BFF llegan con un `code` adosado (ver `toApiError`); si no lo traen, se usa el fallback. */
export function toErrorCode(error: unknown, fallback: string): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && code ? code : fallback;
}
