import { describe, expect, it } from 'vitest';
import {
  cleanSubmissionPayload,
  evaluateCondition,
  formDefinitionSchema,
  isFormValue,
  isFieldEffectivelyRequired,
  isRepeaterRow,
  isUploadReference,
  type ConditionOperator,
  type FormField,
} from './index';
import { validateSubmission } from './validation';

/**
 * Cómo se evalúa un payload contra una definición: operadores de condición,
 * reglas de grilla y los type guards que deciden qué se persiste.
 */

function definitionErrors(definition: unknown): string {
  const parsed = formDefinitionSchema.safeParse(definition);
  return parsed.success ? '' : parsed.error.issues.map((issue) => issue.message).join(' | ');
}

describe('operadores de condición', () => {
  const evaluate = (operator: ConditionOperator, expected: unknown, actual: unknown) =>
    evaluateCondition({ logic: 'all', rules: [{ fieldId: 'origen', operator, value: expected }] }, { origen: actual });

  const cases: [operator: ConditionOperator, expected: unknown, actual: unknown, result: boolean][] = [
    ['equals', 'si', 'si', true],
    ['equals', 'si', 'no', false],
    ['notEquals', 'si', 'no', true],
    ['notEquals', 'si', 'si', false],
    ['in', ['a', 'b'], 'b', true],
    ['in', ['a', 'b'], 'z', false],
    ['in', 'no-es-lista', 'a', false],
    ['notIn', ['a', 'b'], 'z', true],
    ['notIn', ['a', 'b'], 'a', false],
    ['notIn', 'no-es-lista', 'a', false],
    ['greaterThan', 18, 21, true],
    ['greaterThan', 18, 18, false],
    ['greaterThanOrEqual', 18, 18, true],
    ['greaterThanOrEqual', 18, 17, false],
    ['lessThan', 18, 17, true],
    ['lessThan', 18, 18, false],
    ['lessThanOrEqual', 18, 18, true],
    ['lessThanOrEqual', 18, 19, false],
    // Los valores llegan del formulario como texto: la comparación coacciona.
    ['greaterThan', '18', '21', true],
    ['equals', 10, '10', true],
    ['equals', 'true', true, true],
    ['empty', undefined, '', true],
    ['empty', undefined, '  ', true],
    ['empty', undefined, [], true],
    ['empty', undefined, 'algo', false],
    ['notEmpty', undefined, 'algo', true],
    ['notEmpty', undefined, '', false],
  ];

  it.each(cases)('%s %j contra %j', (operator, expected, actual, result) => {
    expect(evaluate(operator, expected, actual)).toBe(result);
  });

  it('combina reglas con lógica all y any', () => {
    const rules = [
      { fieldId: 'a', operator: 'notEmpty' as const },
      { fieldId: 'b', operator: 'equals' as const, value: 'si' },
    ];
    expect(evaluateCondition({ logic: 'all', rules }, { a: 'x', b: 'si' })).toBe(true);
    expect(evaluateCondition({ logic: 'all', rules }, { a: 'x', b: 'no' })).toBe(false);
    expect(evaluateCondition({ logic: 'any', rules }, { a: 'x', b: 'no' })).toBe(true);
    expect(evaluateCondition({ logic: 'any', rules }, { a: '', b: 'no' })).toBe(false);
  });

  it('sin condición declarada, el campo se considera activo', () => {
    expect(evaluateCondition(undefined, {})).toBe(true);
  });
});

describe('reglas propias de las grillas repetibles', () => {
  const cell = (overrides: Record<string, unknown> = {}) => ({
    id: 'c1',
    fieldName: 'celda',
    type: 'text',
    label: 'Celda',
    rules: {},
    ...overrides,
  });

  const grid = (container: Record<string, unknown>, fields: Record<string, unknown>[]) =>
    definitionErrors({
      schemaVersion: 2,
      tipificationKey: 'generic@v1',
      title: 'Grilla',
      submitLabel: 'Enviar',
      containers: [{ id: 'g1', title: 'Filas', kind: 'repeater', fieldName: 'filas', columns: 1, fields, ...container }],
    });

  it('acepta una grilla bien formada', () => {
    expect(grid({}, [cell()])).toBe('');
  });

  it('rechaza grilla sin fieldName y con filas invertidas', () => {
    expect(grid({ fieldName: undefined }, [cell()])).toMatch(/requiere fieldName/);
    expect(grid({ minRows: 5, maxRows: 2 }, [cell()])).toMatch(/minRows no puede superar maxRows/);
  });

  it('rechaza ids y claves duplicadas entre columnas', () => {
    expect(grid({}, [cell(), cell({ fieldName: 'otra' })])).toMatch(/ID de campo duplicado/);
    expect(grid({}, [cell(), cell({ id: 'c2' })])).toMatch(/fieldName duplicado en la grilla/);
  });

  it('rechaza grillas fuera de v2', () => {
    expect(definitionErrors({
      title: 'V1',
      submitLabel: 'Enviar',
      containers: [{ id: 'g1', title: 'Filas', kind: 'repeater', fieldName: 'filas', fields: [] }],
    })).toMatch(/grillas repetibles requieren schemaVersion 2/);
  });

  it('exige el mínimo de filas y valida cada celda', () => {
    const definition = formDefinitionSchema.parse({
      schemaVersion: 2,
      tipificationKey: 'generic@v1',
      title: 'Grilla',
      submitLabel: 'Enviar',
      containers: [{
        id: 'g1',
        title: 'Filas',
        kind: 'repeater',
        fieldName: 'filas',
        columns: 1,
        minRows: 1,
        maxRows: 2,
        fields: [cell({ rules: { required: true } }), cell({ id: 'c2', fieldName: 'monto', type: 'number', rules: { min: 1 } })],
      }],
    });

    expect(validateSubmission(definition, {})).toMatchObject({
      success: false,
      errors: { filas: expect.stringMatching(/al menos 1 fila/) },
    });
    expect(validateSubmission(definition, { filas: [{ celda: 'a' }, { celda: 'b' }, { celda: 'c' }] })).toMatchObject({ success: false });
    expect(validateSubmission(definition, { filas: [{ celda: '', monto: 2 }] })).toMatchObject({
      success: false,
      errors: { 'filas.0.celda': expect.stringMatching(/obligatorio/) },
    });
    expect(validateSubmission(definition, { filas: [{ celda: 'a', monto: 0 }] })).toMatchObject({
      success: false,
      errors: { 'filas.0.monto': expect.stringMatching(/mínimo es 1/) },
    });
    expect(validateSubmission(definition, { filas: 'no-es-una-grilla' })).toMatchObject({ success: false });
    expect(validateSubmission(definition, { filas: [{ celda: 'a', monto: '2' }] })).toMatchObject({
      success: true,
      data: { filas: [{ celda: 'a', monto: 2 }] },
    });
  });
});

describe('type guards del payload', () => {
  const upload = { uploadId: '11111111-1111-4111-8111-111111111111', name: 'a.pdf', contentType: 'application/pdf', size: 10 };

  it('reconoce los valores que el payload admite', () => {
    expect(isFormValue('texto')).toBe(true);
    expect(isFormValue(12)).toBe(true);
    expect(isFormValue(true)).toBe(true);
    expect(isFormValue(['a', 1, false])).toBe(true);
    expect(isFormValue([upload])).toBe(true);
    expect(isFormValue([{ celda: 'a' }])).toBe(true);
    expect(isFormValue({ suelto: 'objeto' })).toBe(false);
    expect(isFormValue([[1, 2]])).toBe(false);
  });

  it('distingue referencias de archivo y filas de grilla', () => {
    expect(isUploadReference(upload)).toBe(true);
    expect(isUploadReference({ ...upload, contentType: 'text/plain' })).toBe(false);
    expect(isRepeaterRow({ a: 'x', b: 2 })).toBe(true);
    expect(isRepeaterRow({ a: { anidado: true } })).toBe(false);
    expect(isRepeaterRow(['a'])).toBe(false);
  });

  it('cleanSubmissionPayload conserva las grillas y descarta lo que no es un valor válido', () => {
    const definition = formDefinitionSchema.parse({
      schemaVersion: 2,
      tipificationKey: 'generic@v1',
      title: 'Limpieza',
      submitLabel: 'Enviar',
      containers: [
        { id: 'c1', title: 'Uno', columns: 1, fields: [{ id: 'f1', fieldName: 'campo', type: 'text', label: 'Campo', rules: {} }] },
        { id: 'g1', title: 'Filas', kind: 'repeater', fieldName: 'filas', columns: 1, fields: [{ id: 'c2', fieldName: 'celda', type: 'text', label: 'Celda', rules: {} }] },
      ],
    });

    expect(cleanSubmissionPayload(definition, { campo: 'ok', filas: [{ celda: 'a' }] })).toEqual({ campo: 'ok', filas: [{ celda: 'a' }] });
    expect(cleanSubmissionPayload(definition, { campo: { objeto: 1 }, filas: 'no-es-grilla' })).toEqual({});
    expect(cleanSubmissionPayload(definition, { campo: '' })).toEqual({});
  });
});

/**
 * Semántica de la obligatoriedad. La regla única: un campo se exige solo si está
 * **visible y habilitado**; oculto o deshabilitado no se exige ni viaja en el
 * payload, aunque sea obligatorio fijo.
 *
 * La tabla recorre las cuatro combinaciones de visible × habilitado por cada
 * forma de declarar obligatoriedad, que es lo que pedía el criterio de aceptación.
 */
describe('obligatoriedad efectiva: visible, oculto, habilitado, deshabilitado', () => {
  const gate = { id: 'gate', fieldName: 'gate', type: 'text' as const, label: 'Gate', width: 'full' as const, rules: {} };

  /** `target` depende de `gate === 'si'` para la dimensión que se esté probando. */
  function build(overrides: Record<string, unknown>) {
    return formDefinitionSchema.parse({
      schemaVersion: 2,
      tipificationKey: 'generic@v1',
      title: 'Obligatoriedad',
      submitLabel: 'Enviar',
      containers: [{
        id: 'c1',
        title: 'Uno',
        kind: 'section',
        columns: 1,
        fields: [gate, { id: 'target', fieldName: 'target', type: 'text', label: 'Target', width: 'full', rules: {}, ...overrides }],
      }],
    });
  }

  const shows = { logic: 'all' as const, rules: [{ fieldId: 'gate', operator: 'equals' as const, value: 'si' }] };

  const cases: Array<{ name: string; definition: unknown; gate: string; exigido: boolean }> = [
    // Obligatorio fijo, sin condiciones: siempre se exige.
    { name: 'fijo · sin condiciones', definition: build({ rules: { required: true } }), gate: 'no', exigido: true },

    // Obligatorio fijo + visibilidad condicional = "obligatorio cuando está visible".
    { name: 'fijo · visible', definition: build({ rules: { required: true }, conditions: { visible: shows } }), gate: 'si', exigido: true },
    { name: 'fijo · oculto', definition: build({ rules: { required: true }, conditions: { visible: shows } }), gate: 'no', exigido: false },

    // Ídem con la habilitación.
    { name: 'fijo · habilitado', definition: build({ rules: { required: true }, conditions: { enabled: shows } }), gate: 'si', exigido: true },
    { name: 'fijo · deshabilitado', definition: build({ rules: { required: true }, conditions: { enabled: shows } }), gate: 'no', exigido: false },

    // Obligatoriedad condicional pura.
    { name: 'condicional cumplida', definition: build({ conditions: { required: shows } }), gate: 'si', exigido: true },
    { name: 'condicional incumplida', definition: build({ conditions: { required: shows } }), gate: 'no', exigido: false },

    // Condicional cumplida pero el campo está oculto: manda la visibilidad.
    {
      name: 'condicional cumplida pero oculto',
      definition: build({ conditions: { required: shows, visible: { logic: 'all', rules: [{ fieldId: 'gate', operator: 'equals', value: 'jamas' }] } } }),
      gate: 'si',
      exigido: false,
    },
  ];

  it.each(cases)('$name → exigido=$exigido', ({ definition, gate: gateValue, exigido }) => {
    const result = validateSubmission(definition as never, { gate: gateValue, target: '' });
    const falla = !result.success && Boolean(result.errors.target);
    expect(falla).toBe(exigido);
  });

  it.each(cases)('$name · el helper coincide con el validador', ({ definition, gate: gateValue, exigido }) => {
    // Contrato y runtime tienen que leer lo mismo: el asterisco que ve el usuario
    // debe significar exactamente lo que el servidor va a exigir.
    const parsed = definition as { containers: { fields: FormField[] }[] };
    const target = parsed.containers[0]!.fields.find((f) => f.id === 'target')!;
    expect(isFieldEffectivelyRequired(target, { gate: gateValue })).toBe(exigido);
  });

  it('un campo oculto y obligatorio no viaja en el payload', () => {
    const definition = build({ rules: { required: true }, conditions: { visible: shows } });
    const payload = cleanSubmissionPayload(definition as never, { gate: 'no', target: 'algo' });
    expect(payload.target).toBeUndefined();
  });
});
