import type { FieldType, FormField, FormOption, MaskKind } from './index.js';

/** Ordered field/block projection shared by the CMS without loading the barrel. */
export function containerItems<T, I extends { kind: string }>(container: { fields: T[]; items?: I[] }): Array<I | { kind: 'field'; field: T }> {
  return container.items ?? container.fields.map((field) => ({ kind: 'field' as const, field }));
}

export function containerFields<T, I extends { kind: string }>(container: { fields: T[]; items?: I[] }): T[] {
  return containerItems(container)
    .filter((item): item is { kind: 'field'; field: T } => item.kind === 'field')
    .map((item) => item.field);
}

/**
 * Listas y comprobaciones de integridad que comparten el contrato y el CMS.
 *
 * Vive en su propio subpath —igual que `field-name`— porque el editor corre
 * sobre Turbopack, que no resuelve los especificadores `.js` que exige
 * NodeNext en el resto del paquete. Este módulo no tiene imports de valor
 * relativos: los `import type` se borran al compilar, así que el bundler
 * nunca necesita resolverlos.
 */

/** Campos de texto que aceptan reglas de longitud mínima/máxima. */
export const TEXT_LENGTH_FIELD_TYPES: FieldType[] = ['text', 'textarea', 'email', 'phone', 'alphabetic', 'alphanumeric'];
/** Campos que admiten máscara de entrada. */
export const MASKABLE_FIELD_TYPES: FieldType[] = ['text', 'phone'];
/** Compatibilidad entre el tipo de campo y cada máscara disponible. */
export const MASK_COMPATIBILITY: Record<MaskKind, FieldType[]> = {
  phone_ar: ['text', 'phone'],
  dni_ar: ['text'],
  cuit_ar: ['text'],
  cbu: ['text'],
};
/** Campos que se configuran con un catálogo de opciones. */
export const CATALOG_FIELD_TYPES: FieldType[] = ['select', 'radio', 'combobox', 'multiselect'];
/** Campos que admiten más de un valor seleccionado. */
export const MULTI_VALUE_FIELD_TYPES: FieldType[] = ['multiselect'];
/** Tipos de campo permitidos como columna de una grilla repetible. */
export const REPEATER_FIELD_TYPES: FieldType[] = [
  'text',
  'email',
  'phone',
  'alphabetic',
  'alphanumeric',
  'number',
  'date',
  'time',
  'checkbox',
  'radio',
  'select',
  'combobox',
];
/** Tipos de campo que no pueden marcarse como solo lectura. */
export const READ_ONLY_UNSUPPORTED_FIELD_TYPES: FieldType[] = ['fileUpload'];

export function isMaskCompatible(fieldType: FieldType, maskKind: MaskKind): boolean {
  return MASK_COMPATIBILITY[maskKind]?.includes(fieldType) ?? false;
}

/** `true` cuando la expresión puede compilarse como RegExp unicode. */
export function isValidRegexPattern(pattern: string): boolean {
  try {
    new RegExp(pattern, 'u');
    return true;
  } catch {
    return false;
  }
}

/** Valores de opción repetidos dentro del catálogo, comparados como texto. */
export function duplicateOptionValues(options: FormOption[] | undefined): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const option of options ?? []) {
    const key = String(option.value).trim();
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }
  return [...duplicates];
}

/**
 * `true` cuando el valor pertenece al catálogo declarado del campo. Compara
 * como texto porque el esquema solo admite opciones `string | number`, así que
 * `10` y `'10'` designan la misma opción.
 */
export function optionCatalogIncludes(options: FormOption[] | undefined, value: unknown): boolean {
  if (value === undefined || value === null) return false;
  const needle = String(value).trim();
  return (options ?? []).some((option) => String(option.value).trim() === needle);
}

/**
 * Valores por defecto que no existen en el catálogo del campo. Devuelve una
 * lista vacía para tipos sin catálogo o cuando el combobox acepta valores libres.
 */
export function defaultValuesOutsideCatalog(
  field: Pick<FormField, 'type' | 'options' | 'defaultValue' | 'allowCustomValue'>,
): string[] {
  if (!CATALOG_FIELD_TYPES.includes(field.type)) return [];
  if (field.type === 'combobox' && field.allowCustomValue !== false) return [];
  if (field.defaultValue === undefined) return [];
  const candidates = Array.isArray(field.defaultValue) ? field.defaultValue : [field.defaultValue];
  return candidates.filter((candidate) => !optionCatalogIncludes(field.options, candidate)).map(String);
}

/** `true` cuando el campo se muestra pero no puede editarse. */
export function isFieldReadOnly(field: Pick<FormField, 'readOnly'>): boolean {
  return field.readOnly === true;
}
