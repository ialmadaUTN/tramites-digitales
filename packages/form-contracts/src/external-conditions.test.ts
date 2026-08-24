import { describe, expect, it } from 'vitest';
import { cleanSubmissionPayload, containerFields, containerItems, evaluateCondition, formDefinitionSchema, type FormDefinition, upgradeDefinitionToV2, upgradeDefinitionToV3 } from './index';
import { validateExternalVariableValues, validateSubmission } from './validation';

function definition(overrides: Record<string, unknown> = {}): FormDefinition {
  return formDefinitionSchema.parse({
    schemaVersion: 3,
    tipificationKey: 'generic@v1',
    externalVariables: [{ name: 'insuranceCode', label: 'Código', type: 'string', trust: 'trusted' }],
    title: 'Condicional', submitLabel: 'Enviar',
    containers: [{ id: 'c1', title: 'Datos', kind: 'section', columns: 1, fields: [
      { id: 'code', fieldName: 'code', type: 'text', label: 'Código', rules: {} },
      { id: 'detail', fieldName: 'detail', type: 'text', label: 'Detalle', rules: { required: true }, conditions: { visible: { logic: 'all', rules: [{ source: { kind: 'external', variable: 'insuranceCode' }, operator: 'in', value: ['2050', '2041', '2043'] }] }, included: { logic: 'all', rules: [{ source: { kind: 'field', fieldId: 'code' }, operator: 'equals', value: 'keep' }] } } },
    ] }],
    ...overrides,
  });
}

describe('condiciones con variables externas y jerarquía', () => {
  it('evalúa grupos anidados y listas', () => {
    const group = { logic: 'any' as const, rules: [{ source: { kind: 'external' as const, variable: 'insuranceCode' }, operator: 'equals' as const, value: '2050' }], groups: [{ logic: 'all' as const, rules: [{ fieldId: 'ok', operator: 'equals' as const, value: true }] }] };
    expect(evaluateCondition(group, { ok: true }, { insuranceCode: '2041' })).toBe(true);
    expect(evaluateCondition(group, { ok: false }, { insuranceCode: '9999' })).toBe(false);
  });

  it('oculta y excluye sin exigir el campo, pero conserva un deshabilitado válido', () => {
    const hidden = definition();
    expect(validateSubmission(hidden, { code: 'drop', detail: '' }, { insuranceCode: '9999' })).toMatchObject({ success: true, data: { code: 'drop' } });
    expect(cleanSubmissionPayload(hidden, { code: 'drop', detail: 'secreto' }, { insuranceCode: '9999' })).toEqual({ code: 'drop' });

    const disabled = definition({ containers: [{ id: 'c1', title: 'Datos', kind: 'section', columns: 1, fields: [
      { id: 'f1', fieldName: 'value', type: 'text', label: 'Valor', rules: {}, conditions: { enabled: { logic: 'all', rules: [{ source: { kind: 'external', variable: 'insuranceCode' }, operator: 'equals', value: '2050' }] } } },
    ] }] });
    expect(validateSubmission(disabled, { value: 'conservado' }, { insuranceCode: '9999' })).toMatchObject({ success: true });
    expect(cleanSubmissionPayload(disabled, { value: 'conservado' }, { insuranceCode: '9999' })).toEqual({ value: 'conservado' });
    expect(validateSubmission(disabled, { value: 123 }, { insuranceCode: '9999' })).toMatchObject({ success: false, errors: { value: expect.any(String) } });
  });

  it('aplica visibilidad, habilitación e inclusión en formulario y sección', () => {
    const hierarchical = definition({
      conditions: { visible: { logic: 'all', rules: [{ source: { kind: 'external', variable: 'insuranceCode' }, operator: 'equals', value: '2050' }] } },
      containers: [{ id: 'c1', title: 'Datos', kind: 'section', columns: 1, conditions: {
        enabled: { logic: 'all', rules: [{ source: { kind: 'external', variable: 'insuranceCode' }, operator: 'equals', value: '2050' }] },
        included: { logic: 'all', rules: [{ source: { kind: 'external', variable: 'insuranceCode' }, operator: 'equals', value: '2050' }] },
      }, fields: [{ id: 'value', fieldName: 'value', type: 'text', label: 'Valor', rules: { required: true } }] }],
    });
    expect(validateSubmission(hierarchical, { value: '' }, { insuranceCode: '9999' })).toMatchObject({ success: true, data: {} });
    expect(validateSubmission(hierarchical, { value: '' }, { insuranceCode: '2050' })).toMatchObject({ success: false, errors: { value: expect.any(String) } });
    expect(cleanSubmissionPayload(hierarchical, { value: 'ok' }, { insuranceCode: '9999' })).toEqual({});
  });

  it('rechaza una variable externa no declarada o con operando de tipo incompatible', () => {
    expect(() => formDefinitionSchema.parse({ ...definition(), containers: [{ id: 'c1', title: 'Datos', fields: [{ id: 'f', fieldName: 'f', type: 'text', label: 'F', rules: {}, conditions: { visible: { logic: 'all', rules: [{ source: { kind: 'external', variable: 'missing' }, operator: 'equals', value: 'x' }] } } }] }] })).toThrow(/no declarada/);
    expect(() => formDefinitionSchema.parse({ ...definition(), externalVariables: [{ name: 'count', label: 'Count', type: 'number', trust: 'trusted' }], containers: [{ id: 'c1', title: 'Datos', fields: [{ id: 'f', fieldName: 'f', type: 'text', label: 'F', rules: {}, conditions: { visible: { logic: 'all', rules: [{ source: { kind: 'external', variable: 'count' }, operator: 'equals', value: 'uno' }] } } }] }] })).toThrow(/tipo number/);
    expect(() => formDefinitionSchema.parse({ ...definition(), externalVariables: [{ name: 'presentation', label: 'Presentación', type: 'string', trust: 'presentation' }], containers: [{ id: 'c1', title: 'Datos', fields: [{ id: 'f', fieldName: 'f', type: 'text', label: 'F', rules: {}, conditions: { visible: { logic: 'all', rules: [{ source: { kind: 'external', variable: 'presentation' }, operator: 'equals', value: 'x' }] } } }] }] })).toThrow(/solo pueden controlar bloques/);
    expect(() => formDefinitionSchema.parse({ ...definition(), conditions: { visible: { logic: 'all', rules: [{ fieldId: 'code', operator: 'notEmpty' }] } } })).toThrow(/descendientes/);
    expect(() => formDefinitionSchema.parse({ ...definition(), conditions: { visible: { logic: 'all', rules: [{ fieldId: 'ghost', operator: 'notEmpty' }] } } })).toThrow(/Campo referido inexistente/);
    expect(() => formDefinitionSchema.parse({ schemaVersion: 2, tipificationKey: 'generic@v1', title: 'Legacy', submitLabel: 'Enviar', containers: [{ id: 'c1', title: 'Datos', fields: [], items: [{ id: 'help', kind: 'textBlock', text: 'Ayuda' }] }] })).toThrow(/bloques informativos requieren/);
    expect(() => formDefinitionSchema.parse({ ...definition(), containers: [{ ...definition().containers[0]!, kind: 'repeater', fieldName: 'rows', fields: [], items: [{ id: 'help', kind: 'textBlock', text: 'Ayuda' }] }] })).toThrow(/solo pueden contener campos/);
    expect(() => formDefinitionSchema.parse({ ...definition(), containers: [{ id: 'c1', title: 'Datos', fields: [{ id: 'f', fieldName: 'f', type: 'text', label: 'F', rules: {}, conditions: { visible: { logic: 'all', rules: [{ source: { kind: 'external', variable: 'insuranceCode' }, operator: 'equals', value: ['x'] }] } } }] }] })).toThrow(/escalar/);
    expect(() => formDefinitionSchema.parse({ ...definition(), containers: [{ id: 'c1', title: 'Datos', kind: 'section', columns: 1, fields: [], items: [{ id: 'help', kind: 'textBlock', text: 'Ayuda', conditions: { enabled: { logic: 'all', rules: [{ source: { kind: 'external', variable: 'insuranceCode' }, operator: 'equals', value: 'x' }] } } }] }] })).toThrow(/Unrecognized key/);
    expect(() => formDefinitionSchema.parse({ ...definition(), containers: [{ id: 'c1', title: 'Datos', fields: [{ id: 'code', fieldName: 'code', type: 'text', label: 'Código', rules: {} }, { id: 'detail', fieldName: 'detail', type: 'text', label: 'Detalle', rules: {}, conditions: { visible: { logic: 'all', rules: [{ fieldId: 'code', operator: 'in', value: [] }] } } }] }] })).toThrow(/lista no vacía/);
    expect(() => formDefinitionSchema.parse({ schemaVersion: 2, tipificationKey: 'generic@v1', title: 'Legacy', submitLabel: 'Enviar', conditions: { visible: { logic: 'all', rules: [{ fieldId: 'f1', operator: 'notEmpty' }] } }, containers: [{ id: 'c1', title: 'Datos', fields: [{ id: 'f1', fieldName: 'f1', type: 'text', label: 'F', rules: {}, conditions: { included: { logic: 'all', rules: [{ fieldId: 'f1', operator: 'notEmpty' }] } } }] }] })).toThrow(/schemaVersion 3/);
  });

  it('aplica límites de profundidad y cantidad a grupos anidados', () => {
    let deep: any = { logic: 'all', rules: [{ fieldId: 'code', operator: 'notEmpty' }] };
    for (let index = 0; index < 9; index += 1) deep = { logic: 'all', rules: [], groups: [deep] };
    expect(() => formDefinitionSchema.parse({ ...definition(), containers: [{ ...definition().containers[0]!, fields: [{ ...definition().containers[0]!.fields[0]!, conditions: { visible: deep } }] }] })).toThrow(/niveles/);
    const many = Array.from({ length: 51 }, () => ({ fieldId: 'code', operator: 'notEmpty' as const }));
    expect(() => formDefinitionSchema.parse({ ...definition(), containers: [{ ...definition().containers[0]!, fields: [{ ...definition().containers[0]!.fields[0]!, conditions: { visible: { logic: 'all', rules: many } } }] }] })).toThrow(/reglas/);
  });

  it('migra una definición anterior a v3 y valida los valores externos declarados', () => {
    const legacy = formDefinitionSchema.parse({ title: 'Legacy', containers: [{ id: 'c1', title: 'Datos', fields: [{ id: 'f1', fieldName: 'f', type: 'text', label: 'F', rules: {} }] }] });
    const migrated = upgradeDefinitionToV3(legacy);
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.externalVariables).toEqual([]);
    expect(containerItems(migrated.containers[0]!)).toHaveLength(1);
    expect(containerFields(migrated.containers[0]!)).toHaveLength(1);
    const legacyCombo = formDefinitionSchema.parse({ title: 'Legacy combo', containers: [{ id: 'c1', title: 'Datos', fields: [{ id: 'combo', fieldName: 'combo', type: 'combobox', label: 'Combo', options: [{ label: 'Sí', value: 'si' }], rules: {} }] }] });
    expect(upgradeDefinitionToV3(legacyCombo).containers[0]?.fields[0]?.allowCustomValue).toBe(true);
    const legacyConditional = formDefinitionSchema.parse({
      title: 'Legacy condicional',
      containers: [{ id: 'c1', title: 'Datos', fields: [
        { id: 'f1', fieldName: 'first', type: 'text', label: 'Primero', rules: {}, conditions: { visible: {
          logic: 'all', rules: [{ fieldId: 'f2', operator: 'notEmpty' }], groups: [{ logic: 'any', rules: [{ fieldId: 'f2', operator: 'equals', value: 'ok' }] }],
        } } },
        { id: 'f2', fieldName: 'second', type: 'text', label: 'Segundo', rules: {} },
      ] }],
    });
    const migratedConditional = upgradeDefinitionToV3(legacyConditional);
    expect(migratedConditional.containers[0]?.fields[0]?.conditions?.visible?.rules[0]?.source).toEqual({ kind: 'field', fieldId: 'f2' });
    expect(migratedConditional.containers[0]?.fields[0]?.conditions?.visible?.groups?.[0]?.rules[0]?.source).toEqual({ kind: 'field', fieldId: 'f2' });
    const valid = validateExternalVariableValues(definition(), { insuranceCode: '2050', ignored: 'x' });
    expect(valid).toMatchObject({ success: true, data: { insuranceCode: '2050' } });
    expect(validateExternalVariableValues(definition(), { insuranceCode: 2050 })).toMatchObject({ success: false });
    expect(upgradeDefinitionToV2(legacy).schemaVersion).toBe(2);
  });
});
