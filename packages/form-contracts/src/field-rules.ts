import type { FieldType, FormField, FormOption, MaskKind } from './index.js';

const TEMPLATE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export type TextTemplateResolution =
  | { success: true; value: string }
  | { success: false; missing: string[]; invalid?: string[]; message: string };

/**
 * Finds the external variable names used by a text template. Double braces
 * are reserved for placeholders; malformed placeholders are reported so an
 * author cannot accidentally publish text that will render differently.
 */
export function textTemplateVariables(template: string): { variables: string[]; error?: string } {
  const variables: string[] = [];
  let cursor = 0;
  while (cursor < template.length) {
    const open = template.indexOf('{{', cursor);
    const closeOutside = template.indexOf('}}', cursor);
    if (open < 0) {
      if (closeOutside >= 0) return { variables, error: 'Hay un cierre de variable sin apertura' };
      break;
    }
    if (closeOutside >= 0 && closeOutside < open) return { variables, error: 'Hay un cierre de variable sin apertura' };
    const close = template.indexOf('}}', open + 2);
    if (close < 0) return { variables, error: 'La variable queda abierta; cerrala con }}' };
    const name = template.slice(open + 2, close).trim();
    if (!TEMPLATE_NAME_PATTERN.test(name)) return { variables, error: `Nombre de variable inválido: ${name || '(vacío)'}` };
    variables.push(name);
    cursor = close + 2;
  }
  return { variables: [...new Set(variables)] };
}

/** Validates template syntax and references against the form catalog. */
export function textTemplateError(template: string, declaredVariables: Iterable<string>): string | undefined {
  const parsed = textTemplateVariables(template);
  if (parsed.error) return parsed.error;
  const declared = new Set(declaredVariables);
  const missing = parsed.variables.find((name) => !declared.has(name));
  return missing ? `La plantilla usa una variable externa no declarada: ${missing}` : undefined;
}

/** Resolves a template using only scalar values supplied by the host. */
export function resolveTextTemplate(template: string, values: Record<string, unknown>): TextTemplateResolution {
  const parsed = textTemplateVariables(template);
  if (parsed.error) return { success: false, missing: [], message: parsed.error };
  const missing = parsed.variables.filter((name) => {
    const value = values[name];
    return value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
      || !['string', 'number', 'boolean'].includes(typeof value);
  });
  if (missing.length > 0) {
    return { success: false, missing, message: `Faltan variables externas: ${missing.join(', ')}` };
  }
  let value = template;
  for (const name of parsed.variables) {
    value = value.replace(new RegExp(`{{\\s*${name}\\s*}}`, 'g'), String(values[name]));
  }
  return { success: true, value };
}

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
