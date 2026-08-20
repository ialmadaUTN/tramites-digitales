import { describe, expect, it } from 'vitest';
import type { FieldType, FormField } from '@tramites/form-contracts';
import { formDefinitionSchema } from '@tramites/form-contracts';
import { FIELD_TYPES } from './constants';
import { changeFieldType } from './definition';

/**
 * `changeFieldType` es la única defensa contra que el editor arrastre
 * configuración que el tipo nuevo no admite y que el contrato después rechaza
 * al guardar. Cada combinación que sobreviva sin limpiarse es un formulario
 * que no se puede publicar.
 */

const loaded = (overrides: Partial<FormField> = {}): FormField => ({
  id: 'f1',
  fieldName: 'campo',
  type: 'text',
  label: 'Campo',
  width: 'full',
  maskKind: 'cuit_ar',
  defaultValue: 'valor',
  readOnly: true,
  rules: {
    minLength: 2,
    maxLength: 8,
    pattern: '^.+$',
    errorMessages: { required: 'R', minLength: 'MIN', maxLength: 'MAX' },
  },
  ...overrides,
});

/** Envuelve el campo en una definición v2 y devuelve los mensajes de rechazo. */
function contractErrors(target: FormField): string {
  const parsed = formDefinitionSchema.safeParse({
    schemaVersion: 2,
    tipificationKey: 'generic@v1',
    title: 'Cambio de tipo',
    submitLabel: 'Enviar',
    containers: [{ id: 'c1', title: 'Uno', kind: 'section', columns: 1, fields: [target] }],
  });
  return parsed.success ? '' : parsed.error.issues.map((issue) => issue.message).join(' | ');
}

describe('changeFieldType deja siempre un campo publicable', () => {
  it.each(FIELD_TYPES.map((type) => [type] as const))(
    'pasar a %s no deja configuración incompatible',
    (type: FieldType) => {
      const next = changeFieldType(loaded(), type);
      expect(next.type).toBe(type);
      expect(contractErrors(next)).toBe('');
    },
  );

  it('desde cada tipo hacia cualquier otro el resultado sigue siendo válido', () => {
    for (const from of FIELD_TYPES) {
      const start = changeFieldType(loaded(), from);
      for (const to of FIELD_TYPES) {
        const next = changeFieldType(start, to);
        expect(contractErrors(next), `${from} -> ${to}`).toBe('');
      }
    }
  });

  const drops: [name: string, type: FieldType, check: (field: FormField) => unknown][] = [
    ['la máscara al pasar a número', 'number', (f) => f.maskKind],
    ['las longitudes al pasar a número', 'number', (f) => f.rules.minLength],
    ['los mensajes de longitud al pasar a número', 'number', (f) => f.rules.errorMessages?.minLength],
    ['el rango numérico al volver a texto', 'text', (f) => f.rules.min],
    ['solo lectura al pasar a archivos', 'fileUpload', (f) => f.readOnly],
    ['el valor por defecto al pasar a archivos', 'fileUpload', (f) => f.defaultValue],
    ['allowCustomValue al salir de combobox', 'text', (f) => f.allowCustomValue],
    ['las opciones al pasar a un tipo sin catálogo', 'text', (f) => f.options],
  ];

  it.each(drops)('descarta %s', (_name, type, check) => {
    const start = changeFieldType(loaded({ type: 'combobox', allowCustomValue: true, options: [{ label: 'A', value: 'a' }] }), 'number');
    const withRange = { ...start, rules: { ...start.rules, min: 1, max: 5 } };
    expect(check(changeFieldType(withRange, type))).toBeUndefined();
  });

  it('conserva lo que el tipo nuevo sí admite', () => {
    const asEmail = changeFieldType(loaded({ rules: { required: true, minLength: 2 } }), 'email');
    expect(asEmail.rules.minLength).toBe(2);
    expect(asEmail.rules.required).toBe(true);
    expect(asEmail.readOnly).toBe(true);
    expect(asEmail.label).toBe('Campo');
    expect(asEmail.fieldName).toBe('campo');
  });

  it('crea un catálogo inicial al pasar a un tipo que lo necesita', () => {
    for (const type of ['select', 'radio', 'combobox', 'multiselect'] as const) {
      const next = changeFieldType(loaded({ options: undefined }), type);
      expect(next.options, type).toHaveLength(1);
    }
  });

  it('conserva el catálogo existente entre tipos con catálogo', () => {
    const options = [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }];
    const next = changeFieldType(loaded({ type: 'select', options, defaultValue: 'a' }), 'radio');
    expect(next.options).toEqual(options);
    expect(next.defaultValue).toBe('a');
  });

  it('el valor por defecto solo sobrevive si el tipo nuevo lo puede representar', () => {
    expect(changeFieldType(loaded({ defaultValue: 'abc' }), 'number').defaultValue).toBeUndefined();
    expect(changeFieldType(loaded({ type: 'number', defaultValue: 12 }), 'number').defaultValue).toBe(12);
    expect(changeFieldType(loaded({ type: 'checkbox', defaultValue: true }), 'text').defaultValue).toBeUndefined();
    expect(changeFieldType(loaded({ type: 'multiselect', defaultValue: ['a'], options: [{ label: 'A', value: 'a' }] }), 'multiselect').defaultValue).toEqual(['a']);
    expect(changeFieldType(loaded({ type: 'multiselect', defaultValue: ['a'], options: [{ label: 'A', value: 'a' }] }), 'select').defaultValue).toBeUndefined();
  });

  it('deja que el editor reporte el solo-lectura obligatorio que se quedó sin valor', () => {
    // Decisión deliberada: si el valor por defecto no sobrevive al cambio de
    // tipo, no desmarcamos "Solo lectura" a espaldas del autor. El campo queda
    // inválido y la validación del editor se lo dice, que es accionable.
    const readOnlyRequired = loaded({ rules: { required: true } });
    const asNumber = changeFieldType(readOnlyRequired, 'number');

    expect(asNumber.readOnly).toBe(true);
    expect(asNumber.rules.required).toBe(true);
    expect(asNumber.defaultValue).toBeUndefined();
    expect(contractErrors(asNumber)).toMatch(/necesita un valor por defecto/);
  });

  it('combobox declara siempre allowCustomValue, como exige el contrato v2', () => {
    expect(changeFieldType(loaded(), 'combobox').allowCustomValue).toBe(false);
    expect(changeFieldType(loaded({ type: 'combobox', allowCustomValue: true }), 'combobox').allowCustomValue).toBe(true);
  });
});
