import { describe, expect, it } from 'vitest';
import { FIELD_NAME_INVALID_MESSAGE, fieldNameError } from './field-name';
import { cleanSubmissionPayload, evaluateCondition, formDefinitionSchema, optionSchema, upgradeDefinitionToV2, validateDefinition } from './index';
import { applyReadOnlyDefaults, validateFieldDefaultValue, validateSubmission } from './validation';

const definition = validateDefinition({
  title: 'Demo',
  submitLabel: 'Enviar',
  containers: [{ id: 'one', title: 'Uno', columns: 1, fields: [
    { id: 'choice', fieldName: 'choice', type: 'radio', label: 'Choice', options: [{ label: 'Sí', value: 'yes' }, { label: 'No', value: 'no' }], rules: { required: true } },
    { id: 'detail', fieldName: 'detail', type: 'text', label: 'Detail', conditions: { visible: { logic: 'all', rules: [{ fieldId: 'choice', operator: 'equals', value: 'yes' }] }, required: { logic: 'all', rules: [{ fieldId: 'choice', operator: 'equals', value: 'yes' }] } }, rules: {} },
  ] }],
});

describe('form contracts', () => {
  it('evaluates conditions and cleans inactive fields', () => {
    expect(evaluateCondition({ logic: 'all', rules: [{ fieldId: 'choice', operator: 'equals', value: 'yes' }] }, { choice: 'yes' })).toBe(true);
    expect(cleanSubmissionPayload(definition, { choice: 'no', detail: 'should be removed' })).toEqual({ choice: 'no' });
  });

  it('valida plantillas de bloques contra el catálogo externo', () => {
    const base = {
      schemaVersion: 3 as const,
      tipificationKey: 'generic@v1',
      externalVariables: [{ name: 'customerName', label: 'Cliente', type: 'string' as const, trust: 'presentation' as const }],
      title: 'Demo',
      submitLabel: 'Enviar',
      containers: [{ id: 'c1', title: 'Datos', fields: [], items: [{ id: 'info', kind: 'textBlock' as const, title: 'Nombre', text: 'Cliente: {{ customerName }}' }] }],
    };
    const baseContainer = base.containers[0]!;
    const baseInfo = baseContainer.items![0]!;
    expect(formDefinitionSchema.parse(base).containers[0]?.items?.[0]).toMatchObject({ kind: 'textBlock' });
    expect(cleanSubmissionPayload(formDefinitionSchema.parse(base), {})).toEqual({});
    expect(() => formDefinitionSchema.parse({ ...base, containers: [{ ...baseContainer, items: [{ ...baseInfo, text: '{{missing}}' }] }] })).toThrow(/no declarada/);
    expect(() => formDefinitionSchema.parse({ ...base, containers: [{ ...baseContainer, items: [{ ...baseInfo, title: '{{' }] }] })).toThrow(/abierta/);
  });

  it('compares equals and notEquals across numbers and trimmed text', () => {
    expect(evaluateCondition({ logic: 'all', rules: [{ fieldId: 'age', operator: 'equals', value: '18' }] }, { age: 18 })).toBe(true);
    expect(evaluateCondition({ logic: 'all', rules: [{ fieldId: 'age', operator: 'notEquals', value: '18' }] }, { age: 18 })).toBe(false);
    expect(evaluateCondition({ logic: 'all', rules: [{ fieldId: 'age', operator: 'notEquals', value: '18' }] }, { age: 21 })).toBe(true);
    expect(evaluateCondition({ logic: 'all', rules: [{ fieldId: 'name', operator: 'equals', value: ' Ana ' }] }, { name: 'Ana' })).toBe(true);
    expect(evaluateCondition({ logic: 'all', rules: [{ fieldId: 'name', operator: 'notEquals', value: 'Ana' }] }, { name: 'Luis' })).toBe(true);
    expect(evaluateCondition({ logic: 'all', rules: [{ fieldId: 'active', operator: 'equals', value: 'true' }] }, { active: true })).toBe(true);
    expect(evaluateCondition({ logic: 'all', rules: [{ fieldId: 'code', operator: 'equals', value: 10 }] }, { code: '10' })).toBe(true);
    expect(evaluateCondition({ logic: 'all', rules: [{ fieldId: 'code', operator: 'notEquals', value: 10 }] }, { code: '11' })).toBe(true);
  });

  it('validates numeric min and max even when the value arrives as text', () => {
    const numberDefinition = validateDefinition({
      title: 'Numeros',
      submitLabel: 'Enviar',
      containers: [{
        id: 'one',
        title: 'Uno',
        columns: 1,
        fields: [{ id: 'age', fieldName: 'age', type: 'number', label: 'Edad', rules: { min: 18, max: 65 } }],
      }],
    });
    expect(validateSubmission(numberDefinition, { age: '10' })).toMatchObject({
      success: false,
      errors: { age: expect.stringMatching(/mínimo es 18/) },
    });
    expect(validateSubmission(numberDefinition, { age: 80 })).toMatchObject({
      success: false,
      errors: { age: expect.stringMatching(/máximo es 65/) },
    });
    expect(validateSubmission(numberDefinition, { age: 30 })).toMatchObject({ success: true });
  });

  it('validates minLength and maxLength on text fields', () => {
    const lengthDefinition = validateDefinition({
      title: 'Largos',
      submitLabel: 'Enviar',
      containers: [{
        id: 'one',
        title: 'Uno',
        columns: 1,
        fields: [{ id: 'name', fieldName: 'name', type: 'text', label: 'Nombre', rules: { minLength: 3, maxLength: 5 } }],
      }],
    });
    expect(validateSubmission(lengthDefinition, { name: 'ab' })).toMatchObject({
      success: false,
      errors: { name: expect.stringMatching(/al menos 3/) },
    });
    expect(validateSubmission(lengthDefinition, { name: 'abcdef' })).toMatchObject({
      success: false,
      errors: { name: expect.stringMatching(/hasta 5/) },
    });
    expect(validateSubmission(lengthDefinition, { name: 'abcd' })).toMatchObject({ success: true });
  });

  it('uses custom minLength and maxLength error labels', () => {
    const lengthDefinition = validateDefinition({
      title: 'Largos',
      submitLabel: 'Enviar',
      containers: [{
        id: 'one',
        title: 'Uno',
        columns: 1,
        fields: [{
          id: 'name',
          fieldName: 'name',
          type: 'text',
          label: 'Nombre',
          rules: {
            minLength: 3,
            maxLength: 5,
            errorMessages: { minLength: 'Muy corto', maxLength: 'Muy largo' },
          },
        }],
      }],
    });
    expect(validateSubmission(lengthDefinition, { name: 'ab' })).toMatchObject({ success: false, errors: { name: 'Muy corto' } });
    expect(validateSubmission(lengthDefinition, { name: 'abcdef' })).toMatchObject({ success: false, errors: { name: 'Muy largo' } });
  });

  it('falls back to default error labels when custom messages are empty', () => {
    const lengthDefinition = validateDefinition({
      title: 'Largos',
      submitLabel: 'Enviar',
      containers: [{
        id: 'one',
        title: 'Uno',
        columns: 1,
        fields: [{
          id: 'name',
          fieldName: 'name',
          type: 'text',
          label: 'Nombre',
          rules: { required: true, minLength: 3, errorMessages: { required: '', minLength: '' } },
        }],
      }],
    });
    expect(validateSubmission(lengthDefinition, { name: '' })).toMatchObject({
      success: false,
      errors: { name: 'Este campo es obligatorio' },
    });
    expect(validateSubmission(lengthDefinition, { name: 'ab' })).toMatchObject({
      success: false,
      errors: { name: expect.stringMatching(/al menos 3/) },
    });
  });

  it('validates conditional required fields and rejects unknown keys', () => {
    expect(validateSubmission(definition, { choice: 'yes' })).toMatchObject({ success: false });
    expect(validateSubmission(definition, { choice: 'no', unknown: 'x' })).toMatchObject({ success: false });
    expect(validateSubmission(definition, { choice: 'yes', detail: 'present' })).toMatchObject({ success: true });
  });

  it('rejects field names that are not simple identifiers', () => {
    expect(fieldNameError('111')).toBe(FIELD_NAME_INVALID_MESSAGE);
    expect(fieldNameError('1abc')).toBe(FIELD_NAME_INVALID_MESSAGE);
    expect(fieldNameError('policy-number')).toBe(FIELD_NAME_INVALID_MESSAGE);
    expect(fieldNameError('')).toBe('El nombre de clave es obligatorio');
    expect(fieldNameError('policyNumber')).toBeUndefined();
    expect(fieldNameError('_private')).toBeUndefined();
    expect(() => validateDefinition({
      title: 'Demo',
      submitLabel: 'Enviar',
      containers: [{
        id: 'one',
        title: 'Uno',
        columns: 1,
        fields: [{ id: 'age', fieldName: '111', type: 'number', label: 'Edad', rules: {} }],
      }],
    })).toThrow(/identificador simple/);
  });

  it('rejects circular dependencies', () => {
    expect(() => validateDefinition({
      title: 'Cycle', submitLabel: 'Enviar', containers: [{ id: 'one', title: 'Uno', columns: 1, fields: [
        { id: 'a', fieldName: 'a', type: 'text', label: 'A', conditions: { visible: { logic: 'all', rules: [{ fieldId: 'b', operator: 'notEmpty' }] } }, rules: {} },
        { id: 'b', fieldName: 'b', type: 'text', label: 'B', conditions: { visible: { logic: 'all', rules: [{ fieldId: 'a', operator: 'notEmpty' }] } }, rules: {} },
      ] }],
    })).toThrow(/Dependencia circular/);
  });

  it('validates v2 specialized text fields and normalizes masks', () => {
    const v2 = validateDefinition({
      schemaVersion: 2,
      tipificationKey: 'generic',
      title: 'V2',
      containers: [{ id: 'one', title: 'Datos', columns: 1, fields: [
        { id: 'email', fieldName: 'email', type: 'email', label: 'Email', rules: { required: true } },
        { id: 'phone', fieldName: 'phone', type: 'phone', label: 'Teléfono', rules: { required: true } },
        { id: 'cuit', fieldName: 'cuit', type: 'text', label: 'CUIT', maskKind: 'cuit_ar', rules: { required: true } },
        { id: 'name', fieldName: 'name', type: 'alphabetic', label: 'Nombre', rules: {} },
      ] }],
    });
    expect(validateSubmission(v2, { email: 'not-an-email', phone: '123', cuit: '20-1234', name: 'Ana 2' })).toMatchObject({ success: false });
    expect(validateSubmission(v2, { email: 'ana@example.com', phone: '+54 (11) 1234-5678', cuit: '20-12345678-3', name: 'Ana Pérez' })).toMatchObject({
      success: true,
      data: { phone: '541112345678', cuit: '20123456783' },
    });
  });

  it('normalizes option whitespace and rejects duplicates after normalization', () => {
    expect(optionSchema.parse({ label: '  Sí  ', value: ' si ' })).toEqual({ label: 'Sí', value: 'si' });
    expect(() => optionSchema.parse({ label: '   ', value: 'si' })).toThrow();
    expect(() => validateDefinition({
      schemaVersion: 2,
      tipificationKey: 'generic',
      title: 'Opciones',
      containers: [{
        id: 'one', title: 'Uno', columns: 1,
        fields: [{ id: 'choice', fieldName: 'choice', type: 'select', label: 'Opción', options: [
          { label: 'Sí', value: 'si' },
          { label: 'Otra', value: ' si ' },
        ], rules: {} }],
      }],
    })).toThrow(/Valor de opción duplicado: si/);
  });

  it('rejects incompatible mask combinations', () => {
    expect(() => validateDefinition({
      schemaVersion: 2,
      tipificationKey: 'generic',
      title: 'Máscaras',
      containers: [{
        id: 'one', title: 'Uno', columns: 1,
        fields: [{ id: 'name', fieldName: 'name', type: 'alphabetic', label: 'Nombre', maskKind: 'dni_ar', rules: {} }],
      }],
    })).toThrow(/no es compatible/);
  });

  it('valida valores iniciales con las reglas del campo', () => {
    expect(validateFieldDefaultValue({
      id: 'email', fieldName: 'email', type: 'email', label: 'Email', width: 'full', defaultValue: 'invalido', rules: {},
    })).toMatch(/email válido/);
    expect(validateFieldDefaultValue({
      id: 'date', fieldName: 'date', type: 'date', label: 'Fecha', width: 'full', defaultValue: '2026-02-30', rules: {},
    })).toMatch(/fecha válida/);
    expect(validateFieldDefaultValue({
      id: 'accepted', fieldName: 'accepted', type: 'checkbox', label: 'Acepto', width: 'full', defaultValue: false, rules: { required: true },
    })).toMatch(/obligatorio/);
    expect(validateFieldDefaultValue({
      id: 'name', fieldName: 'name', type: 'text', label: 'Nombre', width: 'full', defaultValue: 'abc', rules: { minLength: 5 },
    })).toMatch(/al menos 5/);
  });

  it('validates multiselect and strict combobox values', () => {
    const v2 = validateDefinition({
      schemaVersion: 2,
      tipificationKey: 'generic',
      title: 'Choices',
      containers: [{ id: 'one', title: 'Opciones', columns: 1, fields: [
        { id: 'colors', fieldName: 'colors', type: 'multiselect', label: 'Colores', options: [{ label: 'Rojo', value: 'red' }, { label: 'Azul', value: 'blue' }], rules: {} },
        { id: 'city', fieldName: 'city', type: 'combobox', label: 'Ciudad', allowCustomValue: false, options: [{ label: 'Buenos Aires', value: 'ba' }], rules: {} },
      ] }],
    });
    expect(validateSubmission(v2, { colors: ['red', 'unknown'], city: 'custom' })).toMatchObject({ success: false });
    expect(validateSubmission(v2, { colors: ['red'], city: 'ba' })).toMatchObject({ success: true, data: { colors: ['red'], city: 'ba' } });
  });

  it('validates and normalizes repeatable rows', () => {
    const v2 = validateDefinition({
      schemaVersion: 2,
      tipificationKey: 'generic',
      title: 'Rows',
      containers: [{
        id: 'rows', title: 'Registros', kind: 'repeater', fieldName: 'records', columns: 1, minRows: 1, maxRows: 2,
        fields: [
          { id: 'description', fieldName: 'description', type: 'text', label: 'Descripción', rules: { required: true } },
          { id: 'amount', fieldName: 'amount', type: 'number', label: 'Importe', rules: { min: 1 } },
        ],
      }],
    });
    expect(validateSubmission(v2, { records: [{ description: '', amount: 2 }] })).toMatchObject({
      success: false,
      errors: { 'records.0.description': expect.any(String) },
    });
    expect(validateSubmission(v2, { records: [{ description: 'Uno', amount: '2' }] })).toMatchObject({
      success: true,
      data: { records: [{ description: 'Uno', amount: 2 }] },
    });
  });

  it('keeps v1 definitions compatible and blocks v2 controls without schemaVersion', () => {
    const v1 = validateDefinition({ title: 'V1', containers: [{ id: 'one', title: 'Uno', fields: [] }] });
    expect(v1.schemaVersion).toBeUndefined();
    expect(upgradeDefinitionToV2(v1)).toMatchObject({ schemaVersion: 2, tipificationKey: 'generic@v1', containers: [{ kind: 'section' }] });
    const legacyCombo = validateDefinition({ title: 'V1', containers: [{ id: 'one', title: 'Uno', fields: [{ id: 'city', fieldName: 'city', type: 'combobox', label: 'Ciudad', options: [{ label: 'BA', value: 'ba' }], rules: {} }] }] });
    expect(upgradeDefinitionToV2(legacyCombo).containers[0]?.fields[0]?.allowCustomValue).toBe(true);
    expect(() => validateDefinition({ title: 'Invalid', containers: [{ id: 'one', title: 'Uno', fields: [{ id: 'email', fieldName: 'email', type: 'email', label: 'Email', rules: {} }] }] })).toThrow(/schemaVersion 2/);
  });

  it('keeps read-only values under the definition control', () => {
    const v2 = validateDefinition({
      schemaVersion: 2,
      tipificationKey: 'generic',
      title: 'Read only',
      containers: [
        { id: 'one', title: 'Datos', columns: 1, fields: [
          { id: 'branch', fieldName: 'branch', type: 'text', label: 'Sucursal', readOnly: true, defaultValue: 'Centro', rules: { required: true } },
          { id: 'note', fieldName: 'note', type: 'text', label: 'Nota', readOnly: true, rules: {} },
        ] },
        { id: 'rows', title: 'Ítems', kind: 'repeater', fieldName: 'items', columns: 1, fields: [
          { id: 'code', fieldName: 'code', type: 'text', label: 'Código', readOnly: true, defaultValue: 'FIJO', rules: {} },
          { id: 'qty', fieldName: 'qty', type: 'number', label: 'Cantidad', rules: {} },
        ] },
      ],
    });

    expect(validateSubmission(v2, { branch: 'Sucursal falsa', note: 'inyectada', items: [{ code: 'HACK', qty: 2 }] })).toMatchObject({
      success: true,
      data: { branch: 'Centro', items: [{ code: 'FIJO', qty: 2 }] },
    });
    // Sin defaultValue no hay nada que imponer: la clave se descarta.
    expect(applyReadOnlyDefaults(v2, { note: 'inyectada' })).toEqual({ branch: 'Centro' });
  });

  it('rejects definitions with inconsistent rules, catalogs or read-only setups', () => {
    const field = (overrides: Record<string, unknown>) => ({
      schemaVersion: 2,
      tipificationKey: 'generic',
      title: 'Reglas',
      containers: [{ id: 'one', title: 'Uno', columns: 1, fields: [
        { id: 'a', fieldName: 'a', type: 'text', label: 'A', rules: {}, ...overrides },
      ] }],
    });

    expect(() => validateDefinition(field({ rules: { pattern: '([a-z' } }))).toThrow(/expresión regular no es válida/);
    expect(() => validateDefinition(field({ rules: { minLength: 9, maxLength: 2 } }))).toThrow(/mínimo de caracteres no puede superar/);
    expect(() => validateDefinition(field({ type: 'number', rules: { min: 9, max: 2 } }))).toThrow(/mínimo numérico no puede superar/);
    expect(() => validateDefinition(field({ rules: { min: 1 } }))).toThrow(/no admite rangos numéricos/);
    expect(() => validateDefinition(field({ type: 'date', rules: { maxLength: 4 } }))).toThrow(/no admite reglas de longitud/);
    expect(() => validateDefinition(field({
      type: 'select',
      options: [{ label: 'Sí', value: 'si' }, { label: 'Otro', value: 'si' }],
    }))).toThrow(/Valor de opción duplicado: si/);
    expect(() => validateDefinition(field({
      type: 'select',
      defaultValue: 'no',
      options: [{ label: 'Sí', value: 'si' }],
    }))).toThrow(/no pertenece al catálogo/);
    expect(() => validateDefinition(field({ readOnly: true, rules: { required: true } }))).toThrow(/necesita un valor por defecto/);
    expect(() => validateDefinition(field({ type: 'fileUpload', readOnly: true }))).toThrow(/no admite solo lectura/);
    expect(() => validateDefinition(field({ type: 'alphabetic', maskKind: 'dni_ar' }))).toThrow(/no es compatible/);
  });
});
