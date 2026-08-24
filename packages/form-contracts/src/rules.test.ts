import { describe, expect, it } from 'vitest';
import {
  cleanSubmissionPayload,
  evaluateCondition,
  formDefinitionSchema,
  isFormValue,
  isRepeaterRow,
  isUploadReference,
  type ConditionOperator,
  type FormDefinition,
  type FormField,
} from './index';
import { validateFieldDefaultValue, validateSubmission } from './validation';

/**
 * El valor del contrato está en lo que **rechaza**: cada regla que no tiene un
 * caso negativo es una regla que puede desaparecer sin que nadie se entere.
 *
 * Las tablas de abajo son el índice de esas reglas. Agregar una regla al
 * contrato significa agregar una fila acá, no un `it` nuevo.
 */

const field = (overrides: Partial<FormField> = {}): FormField => ({
  id: 'f1',
  fieldName: 'campo',
  type: 'text',
  label: 'Campo',
  width: 'full',
  rules: {},
  ...overrides,
});

/** Definición v2 mínima con un único campo, ya normalizada por el esquema. */
function defineOne(target: FormField): FormDefinition {
  return formDefinitionSchema.parse({
    schemaVersion: 2,
    tipificationKey: 'generic@v1',
    title: 'Reglas',
    submitLabel: 'Enviar',
    containers: [{ id: 'c1', title: 'Uno', kind: 'section', columns: 1, fields: [target] }],
  });
}

function rawDefinition(target: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 2,
    tipificationKey: 'generic@v1',
    title: 'Reglas',
    submitLabel: 'Enviar',
    containers: [{ id: 'c1', title: 'Uno', kind: 'section', columns: 1, fields: [{ id: 'f1', fieldName: 'campo', label: 'Campo', rules: {}, ...target }] }],
    ...overrides,
  };
}

function definitionErrors(definition: unknown): string {
  const parsed = formDefinitionSchema.safeParse(definition);
  return parsed.success ? '' : parsed.error.issues.map((issue) => issue.message).join(' | ');
}

describe('rechazo de definiciones inválidas', () => {
  const cases: [name: string, target: Record<string, unknown>, expected: RegExp][] = [
    ['regex que no compila', { type: 'text', rules: { pattern: '([a-z' } }, /expresión regular no es válida/],
    ['longitudes invertidas', { type: 'text', rules: { minLength: 9, maxLength: 2 } }, /mínimo de caracteres no puede superar/],
    ['rango numérico invertido', { type: 'number', rules: { min: 9, max: 2 } }, /mínimo numérico no puede superar/],
    ['rango numérico en campo no numérico', { type: 'text', rules: { min: 1 } }, /no admite rangos numéricos/],
    ['longitud en campo sin texto', { type: 'date', rules: { maxLength: 4 } }, /no admite reglas de longitud/],
    ['opciones duplicadas', { type: 'select', options: [{ label: 'Sí', value: 'si' }, { label: 'Otro', value: 'si' }] }, /duplicado: si/],
    ['catálogo vacío', { type: 'select', options: [] }, /requiere opciones/],
    ['default fuera del catálogo', { type: 'select', defaultValue: 'no', options: [{ label: 'Sí', value: 'si' }] }, /no pertenece al catálogo/],
    ['default múltiple en campo simple', { type: 'text', defaultValue: ['a', 'b'] }, /no admite un valor por defecto múltiple/],
    ['solo lectura obligatorio sin default', { type: 'text', readOnly: true, rules: { required: true } }, /necesita un valor por defecto/],
    ['solo lectura en archivos', { type: 'fileUpload', readOnly: true }, /no admite solo lectura/],
    ['máscara incompatible con el tipo', { type: 'phone', maskKind: 'cuit_ar' }, /no es compatible con el tipo/],
    ['archivos con mínimo mayor al máximo', { type: 'fileUpload', minFiles: 4, maxFiles: 2 }, /minFiles no puede superar maxFiles/],
    ['config de archivos en otro tipo', { type: 'text', minFiles: 1 }, /solo aplica a fileUpload/],
    ['allowCustomValue fuera de combobox', { type: 'text', allowCustomValue: true }, /solo aplica a combobox/],
    ['combobox v2 sin declarar allowCustomValue', { type: 'combobox', options: [{ label: 'A', value: 'a' }] }, /deben declarar allowCustomValue/],
    ['opción sin etiqueta', { type: 'select', options: [{ label: '   ', value: 'a' }] }, /etiqueta de la opción es obligatoria/],
    ['opción sin valor', { type: 'select', options: [{ label: 'A', value: '  ' }] }, /valor de la opción es obligatorio/],
    ['fieldName que no es identificador', { type: 'text', fieldName: '1abc' }, /identificador simple/],
    ['condición que se referencia a sí misma', { type: 'text', conditions: { visible: { logic: 'all', rules: [{ fieldId: 'f1', operator: 'notEmpty' }] } } }, /se referencia a sí misma/],
    ['condición a un campo inexistente', { type: 'text', conditions: { visible: { logic: 'all', rules: [{ fieldId: 'fantasma', operator: 'notEmpty' }] } } }, /Campo referido inexistente/],
    ['obligatoriedad fija y condicional a la vez', { type: 'text', rules: { required: true }, conditions: { required: { logic: 'all', rules: [{ fieldId: 'fantasma', operator: 'notEmpty' }] } } }, /no puede tener además obligatoriedad condicional/],
  ];

  it.each(cases)('rechaza %s', (_name, target, expected) => {
    expect(definitionErrors(rawDefinition(target))).toMatch(expected);
  });

  const textBlockCases: [name: string, block: Record<string, unknown>, expected: RegExp][] = [
    ['contenido informativo vacío', { id: 'info', kind: 'textBlock', text: '   ' }, /contenido del bloque no puede estar vacío/],
    ['plantilla con variable no declarada', { id: 'info', kind: 'textBlock', text: '{{customerName}}' }, /variable externa no declarada/],
    ['plantilla malformada', { id: 'info', kind: 'textBlock', text: '{{customerName' }, /variable queda abierta/],
  ];

  it.each(textBlockCases)('rechaza %s', (_name, block, expected) => {
    expect(definitionErrors({
      schemaVersion: 3,
      tipificationKey: 'generic@v1',
      externalVariables: [],
      title: 'Reglas',
      submitLabel: 'Enviar',
      containers: [{ id: 'c1', title: 'Uno', kind: 'section', columns: 1, fields: [], items: [block] }],
    })).toMatch(expected);
  });

  it('acepta una definición que cumple todas las reglas', () => {
    expect(definitionErrors(rawDefinition({ type: 'text', rules: { minLength: 2, maxLength: 8, pattern: '^[a-z]+$' } }))).toBe('');
  });

  it('exige tipificationKey en v2 y bloquea controles v2 en v1', () => {
    expect(definitionErrors(rawDefinition({ type: 'text' }, { tipificationKey: undefined }))).toMatch(/requiere tipificationKey/);
    expect(definitionErrors({
      title: 'V1',
      submitLabel: 'Enviar',
      containers: [{ id: 'c1', title: 'Uno', fields: [{ id: 'f1', fieldName: 'campo', type: 'text', label: 'Campo', readOnly: true, rules: {} }] }],
    })).toMatch(/solo lectura requieren schemaVersion 2/);
  });
});

describe('validación de valores enviados, por tipo de campo', () => {
  const cases: [name: string, target: FormField, value: unknown, valid: boolean][] = [
    ['email con formato válido', field({ type: 'email' }), 'ana@example.com', true],
    ['email sin arroba', field({ type: 'email' }), 'ana.example.com', false],
    ['teléfono con separadores', field({ type: 'phone' }), '+54 (11) 1234-5678', true],
    ['teléfono demasiado corto', field({ type: 'phone' }), '123', false],
    ['teléfono con letras', field({ type: 'phone' }), 'no-es-un-tel', false],
    ['solo letras con acentos', field({ type: 'alphabetic' }), 'Ana Pérez', true],
    ['solo letras con dígitos', field({ type: 'alphabetic' }), 'Ana 2', false],
    ['alfanumérico válido', field({ type: 'alphanumeric' }), 'Casa 12', true],
    ['alfanumérico con símbolos', field({ type: 'alphanumeric' }), 'Casa #12', false],
    ['número dentro del rango', field({ type: 'number', rules: { min: 1, max: 10 } }), 5, true],
    ['número fuera del rango', field({ type: 'number', rules: { min: 1, max: 10 } }), 50, false],
    ['número no numérico', field({ type: 'number' }), 'abc', false],
    ['checkbox booleano', field({ type: 'checkbox' }), true, true],
    ['checkbox con texto', field({ type: 'checkbox' }), 'true', false],
    ['CUIT con máscara válida', field({ type: 'text', maskKind: 'cuit_ar' }), '20-12345678-3', true],
    ['CUIT incompleto', field({ type: 'text', maskKind: 'cuit_ar' }), '20-123', false],
    ['DNI válido', field({ type: 'text', maskKind: 'dni_ar' }), '12.345.678', true],
    ['DNI demasiado largo', field({ type: 'text', maskKind: 'dni_ar' }), '123456789012', false],
    ['CBU válido', field({ type: 'text', maskKind: 'cbu' }), '0'.repeat(22), true],
    ['CBU corto', field({ type: 'text', maskKind: 'cbu' }), '0'.repeat(10), false],
    ['teléfono con máscara argentina', field({ type: 'phone', maskKind: 'phone_ar' }), '11 1234 5678', true],
    ['opción del catálogo', field({ type: 'select', options: [{ label: 'Sí', value: 'si' }] }), 'si', true],
    ['opción fuera del catálogo', field({ type: 'select', options: [{ label: 'Sí', value: 'si' }] }), 'no', false],
    ['multiselect con opciones válidas', field({ type: 'multiselect', options: [{ label: 'A', value: 'a' }] }), ['a'], true],
    ['multiselect con una opción inválida', field({ type: 'multiselect', options: [{ label: 'A', value: 'a' }] }), ['a', 'z'], false],
    ['combobox libre acepta texto nuevo', field({ type: 'combobox', allowCustomValue: true, options: [{ label: 'A', value: 'a' }] }), 'otra', true],
    ['combobox estricto rechaza texto nuevo', field({ type: 'combobox', allowCustomValue: false, options: [{ label: 'A', value: 'a' }] }), 'otra', false],
    ['regex que se cumple', field({ type: 'text', rules: { pattern: '^[A-Z0-9]+$' } }), 'AB12', true],
    ['regex que no se cumple', field({ type: 'text', rules: { pattern: '^[A-Z0-9]+$' } }), 'ab12', false],
  ];

  it.each(cases)('%s', (_name, target, value, valid) => {
    const result = validateSubmission(defineOne(target), { [target.fieldName]: value });
    expect(result.success, JSON.stringify('errors' in result ? result.errors : {})).toBe(valid);
  });
});

describe('validación de archivos adjuntos', () => {
  const upload = (overrides: Record<string, unknown> = {}) => ({
    uploadId: '11111111-1111-4111-8111-111111111111',
    name: 'acta.pdf',
    contentType: 'application/pdf',
    size: 1024,
    ...overrides,
  });
  const target = field({ type: 'fileUpload', minFiles: 1, maxFiles: 2 });

  const submit = (value: unknown) => validateSubmission(defineOne(target), { campo: value });

  it('acepta una referencia bien formada', () => {
    expect(submit([upload()])).toMatchObject({ success: true });
  });

  it('rechaza cantidad, tipo, tamaño y forma inválidos', () => {
    expect(submit([upload(), upload(), upload()])).toMatchObject({ success: false });
    expect(submit([upload({ contentType: 'text/plain' })])).toMatchObject({ success: false });
    expect(submit([upload({ size: 11 * 1024 * 1024 })])).toMatchObject({ success: false });
    expect(submit([{ name: 'suelto.pdf' }])).toMatchObject({ success: false });
    expect(submit('no-es-una-lista')).toMatchObject({ success: false });
  });
});

describe('valores por defecto configurados en el CMS', () => {
  const cases: [name: string, target: FormField, expected: RegExp | undefined][] = [
    ['texto simple', field({ defaultValue: 'hola' }), undefined],
    ['sin valor', field({}), undefined],
    ['email inválido', field({ type: 'email', defaultValue: 'no-es-mail' }), /email válido/],
    ['teléfono inválido', field({ type: 'phone', defaultValue: '12' }), /teléfono válido/],
    ['solo letras con número', field({ type: 'alphabetic', defaultValue: 'Ana 2' }), /Solo se permiten letras/],
    ['alfanumérico con símbolo', field({ type: 'alphanumeric', defaultValue: 'Ana!' }), /letras y números/],
    ['fecha inexistente', field({ type: 'date', defaultValue: '2026-02-31' }), /fecha válida/],
    ['fecha con formato libre', field({ type: 'date', defaultValue: '31/02/2026' }), /fecha válida/],
    ['fecha válida', field({ type: 'date', defaultValue: '2026-02-28' }), undefined],
    ['hora inválida', field({ type: 'time', defaultValue: '25:00' }), /horario válido/],
    ['hora válida', field({ type: 'time', defaultValue: '23:59' }), undefined],
    ['número fuera de rango', field({ type: 'number', defaultValue: 50, rules: { max: 10 } }), /valor máximo es 10/],
    ['número por debajo del mínimo', field({ type: 'number', defaultValue: 1, rules: { min: 10 } }), /valor mínimo es 10/],
    ['número no numérico', field({ type: 'number', defaultValue: 'x' }), /debe ser un número/],
    ['checkbox con texto', field({ type: 'checkbox', defaultValue: 'sí' }), /true o false/],
    ['checkbox booleano', field({ type: 'checkbox', defaultValue: false }), undefined],
    ['select fuera del catálogo', field({ type: 'select', defaultValue: 'z', options: [{ label: 'A', value: 'a' }] }), /opción válida/],
    ['radio dentro del catálogo', field({ type: 'radio', defaultValue: 'a', options: [{ label: 'A', value: 'a' }] }), undefined],
    ['multiselect con valor ajeno', field({ type: 'multiselect', defaultValue: ['z'], options: [{ label: 'A', value: 'a' }] }), /opciones válidas/],
    ['multiselect válido', field({ type: 'multiselect', defaultValue: ['a'], options: [{ label: 'A', value: 'a' }] }), undefined],
    ['combobox estricto fuera del listado', field({ type: 'combobox', allowCustomValue: false, defaultValue: 'z', options: [{ label: 'A', value: 'a' }] }), /del listado/],
    ['combobox libre con valor nuevo', field({ type: 'combobox', allowCustomValue: true, defaultValue: 'z', options: [{ label: 'A', value: 'a' }] }), undefined],
    ['archivos con valor por defecto', field({ type: 'fileUpload', defaultValue: 'x' }), /no admiten valor por defecto/],
    ['lista en un campo simple', field({ defaultValue: ['a', 'b'] }), /varios valores por defecto/],
    ['CUIT incompleto', field({ maskKind: 'cuit_ar', defaultValue: '20-1' }), /CUIT válido/],
    ['DNI válido', field({ maskKind: 'dni_ar', defaultValue: '12345678' }), undefined],
    ['por debajo del mínimo de caracteres', field({ defaultValue: 'ab', rules: { minLength: 3 } }), /al menos 3 caracteres/],
    ['por encima del máximo de caracteres', field({ defaultValue: 'abcdef', rules: { maxLength: 3 } }), /hasta 3 caracteres/],
    ['regex incumplida', field({ defaultValue: 'abc', rules: { pattern: '^[0-9]+$' } }), /formato no es válido/],
    ['regex inválida', field({ defaultValue: 'abc', rules: { pattern: '([a-z' } }), /expresión regular no es válida/],
    ['vacío en campo obligatorio', field({ defaultValue: '', rules: { required: true } }), /obligatorio/],
    ['vacío en campo opcional', field({ defaultValue: '' }), undefined],
  ];

  it.each(cases)('%s', (_name, target, expected) => {
    const error = validateFieldDefaultValue(target);
    if (expected === undefined) expect(error).toBeUndefined();
    else expect(error).toMatch(expected);
  });

  it('respeta los mensajes de error personalizados', () => {
    expect(validateFieldDefaultValue(field({ type: 'email', defaultValue: 'x', rules: { errorMessages: { pattern: 'Mail mal escrito' } } })))
      .toBe('Mail mal escrito');
  });
});

/**
 * Compatibilidad entre obligatoriedad fija y lógica condicional.
 *
 * La fila de la tabla de arriba cubre el rechazo; acá se verifica sobre una
 * definición de dos campos, donde la condición apunta a un campo real y el
 * conflicto es el **único** problema.
 */
describe('obligatoriedad fija frente a las condiciones', () => {
  const gate = { id: 'gate', fieldName: 'gate', type: 'text', label: 'Gate', width: 'full', rules: {} };
  const pointsAtGate = { logic: 'all', rules: [{ fieldId: 'gate', operator: 'notEmpty' }] };

  function twoFields(target: Record<string, unknown>) {
    return {
      schemaVersion: 2,
      tipificationKey: 'generic@v1',
      title: 'Reglas',
      submitLabel: 'Enviar',
      containers: [{
        id: 'c1',
        title: 'Uno',
        kind: 'section',
        columns: 1,
        fields: [gate, { id: 'f1', fieldName: 'campo', type: 'text', label: 'Campo', width: 'full', rules: {}, ...target }],
      }],
    };
  }

  it('rechaza obligatorio fijo con obligatoriedad condicional, y es el único error', () => {
    const errors = definitionErrors(twoFields({ rules: { required: true }, conditions: { required: pointsAtGate } }));
    expect(errors).toBe('Un campo obligatorio no puede tener además obligatoriedad condicional: dejá solo una de las dos');
  });

  const permitidas: [string, Record<string, unknown>][] = [
    // La fija convive con visibilidad y habilitación: significa "obligatorio
    // cuando está visible y habilitado", que es una configuración legítima.
    ['fija + visibilidad condicional', { rules: { required: true }, conditions: { visible: pointsAtGate } }],
    ['fija + habilitación condicional', { rules: { required: true }, conditions: { enabled: pointsAtGate } }],
    ['fija + visibilidad + habilitación', { rules: { required: true }, conditions: { visible: pointsAtGate, enabled: pointsAtGate } }],
    ['condicional sola', { conditions: { required: pointsAtGate } }],
    ['condicional + visibilidad', { conditions: { required: pointsAtGate, visible: pointsAtGate } }],
    ['sin obligatoriedad', {}],
  ];

  it.each(permitidas)('acepta %s', (_name, target) => {
    expect(definitionErrors(twoFields(target))).toBe('');
  });
});
