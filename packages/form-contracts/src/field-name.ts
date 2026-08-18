export const FIELD_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const FIELD_NAME_INVALID_MESSAGE =
  'Usá un identificador simple: letras, números y _ . No puede empezar con un número.';

export function fieldNameError(value: string): string | undefined {
  if (!value.trim()) return 'El nombre de clave es obligatorio';
  if (!FIELD_NAME_PATTERN.test(value)) return FIELD_NAME_INVALID_MESSAGE;
  return undefined;
}
