import { describe, expect, it } from 'vitest';
import type { ConditionOperator, FormDefinition } from '@tramites/form-contracts';
import { FIELD_NAME_INVALID_MESSAGE } from '@tramites/form-contracts/field-name';
import { collectDefinitionEditorErrors } from './editor-validation';

const definition: FormDefinition = {
  title: 'Demo',
  submitLabel: 'Enviar',
  containers: [
    {
      id: 'c1',
      title: 'Uno',
      columns: 1,
      fields: [
        { id: 'f1', fieldName: '111', type: 'text', label: 'A', width: 'full', rules: {} },
        { id: 'f2', fieldName: 'age', type: 'number', label: 'Edad', width: 'full', rules: {} },
      ],
    },
  ],
};

describe('collectDefinitionEditorErrors', () => {
  it('flags field names that are not simple identifiers', () => {
    const errors = collectDefinitionEditorErrors(definition, 'Nuevo formulario');
    expect(errors.hasErrors).toBe(true);
    expect(errors.fields.f1?.fieldName).toBe(FIELD_NAME_INVALID_MESSAGE);
    expect(errors.fields.f2).toBeUndefined();
  });

  it('flags duplicated field names under both inputs', () => {
    const errors = collectDefinitionEditorErrors({
      ...definition,
      containers: [{
        id: 'c1',
        title: 'Uno',
        columns: 1,
        fields: [
          { id: 'f1', fieldName: 'age', type: 'text', label: 'A', width: 'full', rules: {} },
          { id: 'f2', fieldName: 'age', type: 'number', label: 'Edad', width: 'full', rules: {} },
        ],
      }],
    }, 'Form');
    expect(errors.fields.f1?.fieldName).toMatch(/ya se usa/);
    expect(errors.fields.f2?.fieldName).toMatch(/ya se usa/);
  });

  it('accepts a valid definition', () => {
    const errors = collectDefinitionEditorErrors({
      ...definition,
      containers: [{
        ...definition.containers[0]!,
        fields: [{ id: 'f1', fieldName: 'policyNumber', type: 'text', label: 'Póliza', width: 'full', rules: {} }],
      }],
    }, 'Solicitud');
    expect(errors.hasErrors).toBe(false);
  });

  it('flags undeclared external sources and accepts trusted catalog entries', () => {
    const invalid = collectDefinitionEditorErrors({
      schemaVersion: 3, tipificationKey: 'generic@v1', externalVariables: [], title: 'Demo', submitLabel: 'Enviar',
      containers: [{ ...definition.containers[0]!, fields: [{ ...definition.containers[0]!.fields[0]!, fieldName: 'campo', conditions: { visible: { logic: 'all', rules: [{ source: { kind: 'external', variable: 'insuranceCode' }, operator: 'equals', value: '2050' }] } } }] }],
    }, 'Form');
    expect(invalid.fields.f1?.conditions).toMatch(/variable externa/);
    const valid = collectDefinitionEditorErrors({
      schemaVersion: 3, tipificationKey: 'generic@v1', externalVariables: [{ name: 'insuranceCode', label: 'Código', type: 'string', trust: 'trusted' }], title: 'Demo', submitLabel: 'Enviar',
      containers: [{ ...definition.containers[0]!, fields: [{ ...definition.containers[0]!.fields[0]!, fieldName: 'campo', conditions: { visible: { logic: 'all', rules: [{ source: { kind: 'external', variable: 'insuranceCode' }, operator: 'equals', value: '2050' }] } } }] }],
    }, 'Form');
    expect(valid.fields.f1?.conditions).toBeUndefined();
  });

  it('flags presentation variables outside blocks and descendant references on containers', () => {
    const presentation = collectDefinitionEditorErrors({
      schemaVersion: 3, tipificationKey: 'generic@v1', externalVariables: [{ name: 'mode', label: 'Modo', type: 'string', trust: 'presentation' }], title: 'Demo', submitLabel: 'Enviar',
      containers: [{ ...definition.containers[0]!, fields: [{ ...definition.containers[0]!.fields[0]!, fieldName: 'campo', conditions: { visible: { logic: 'all', rules: [{ source: { kind: 'external', variable: 'mode' }, operator: 'equals', value: 'x' }] } } }] }],
    }, 'Form');
    expect(presentation.fields.f1?.conditions).toMatch(/bloques/);
    const nonexistent = collectDefinitionEditorErrors({
      ...definition,
      conditions: { visible: { logic: 'all', rules: [{ fieldId: 'ghost', operator: 'notEmpty' }] } },
    }, 'Form');
    expect(nonexistent.conditions).toMatch(/campo inexistente/);
    const descendant = collectDefinitionEditorErrors({
      ...definition,
      conditions: { visible: { logic: 'all', rules: [{ fieldId: 'f1', operator: 'notEmpty' }] } },
    }, 'Form');
    expect(descendant.conditions).toMatch(/descendientes/);
  });

  it('valida expresiones de formulario/sección y grupos sin reglas directas', () => {
    const valid = collectDefinitionEditorErrors({
      schemaVersion: 3, tipificationKey: 'generic@v1', externalVariables: [{ name: 'mode', label: 'Modo', type: 'string', trust: 'trusted' }], title: 'Demo', submitLabel: 'Enviar',
      conditions: { visible: { logic: 'all', rules: [{ source: { kind: 'external', variable: 'mode' }, operator: 'in', value: ['a', 'b'] }] } },
      containers: [{ ...definition.containers[0]!, fields: [{ ...definition.containers[0]!.fields[0]!, fieldName: 'campo' }, { ...definition.containers[0]!.fields[1]!, fieldName: 'edad' }], conditions: { enabled: { logic: 'any', rules: [], groups: [{ logic: 'all', rules: [{ source: { kind: 'external', variable: 'mode' }, operator: 'notEquals', value: 'off' }] }] } } }],
    }, 'Form');
    expect(valid.hasErrors).toBe(false);

    const incomplete = collectDefinitionEditorErrors({
      ...definition,
      conditions: { visible: { logic: 'all', rules: [{} as never] } },
    }, 'Form');
    expect(incomplete.conditions).toMatch(/origen/);
    const emptyIn = collectDefinitionEditorErrors({
      ...definition,
      containers: [{ ...definition.containers[0]!, fields: [{ ...definition.containers[0]!.fields[0]!, conditions: { visible: { logic: 'all', rules: [{ fieldId: 'f2', operator: 'in', value: [] }] } } }, definition.containers[0]!.fields[1]!] }],
    }, 'Form');
    expect(emptyIn.fields.f1?.conditions).toMatch(/inclusión/);
  });

  it('valida operandos tipados y condiciones de bloques informativos', () => {
    const external = (variable: string, type: 'string' | 'number' | 'boolean') => ({ name: variable, label: variable, type, trust: 'trusted' as const });
    const withFieldCondition = (variable: string, type: 'string' | 'number' | 'boolean', operator: ConditionOperator, value: unknown) => collectDefinitionEditorErrors({
      schemaVersion: 3,
      tipificationKey: 'generic@v1',
      externalVariables: [external(variable, type)],
      title: 'Demo', submitLabel: 'Enviar',
      containers: [{ ...definition.containers[0]!, fields: [{ ...definition.containers[0]!.fields[0]!, fieldName: 'campo', conditions: { visible: { logic: 'all', rules: [{ source: { kind: 'external', variable }, operator, value }] } } }] }],
    }, 'Form');

    expect(withFieldCondition('count', 'number', 'equals', 'uno').fields.f1?.conditions).toMatch(/tipo number/);
    expect(withFieldCondition('count', 'number', 'equals', ['1']).fields.f1?.conditions).toMatch(/escalar/);
    expect(withFieldCondition('mode', 'string', 'greaterThan', 'x').fields.f1?.conditions).toMatch(/comparaciones numéricas/);
    expect(withFieldCondition('count', 'number', 'in', []).fields.f1?.conditions).toMatch(/inclusión/);

    const blockDefinition: FormDefinition = {
      schemaVersion: 3, tipificationKey: 'generic@v1',
      externalVariables: [{ name: 'mode', label: 'Modo', type: 'string', trust: 'presentation' }],
      title: 'Demo', submitLabel: 'Enviar',
      containers: [{ ...definition.containers[0]!, items: [
        { kind: 'field', field: { ...definition.containers[0]!.fields[0]!, fieldName: 'campo' } },
        { kind: 'textBlock', id: 'help', text: 'Ayuda' },
        { kind: 'textBlock', id: 'help-2', text: 'Contexto', conditions: { visible: { logic: 'all', rules: [{ source: { kind: 'external', variable: 'mode' }, operator: 'equals', value: 'x' }] } } },
      ] }],
    };
    expect(collectDefinitionEditorErrors(blockDefinition, 'Form').hasErrors).toBe(false);
    const dynamicBlock = { ...blockDefinition, externalVariables: [{ name: 'customerName', label: 'Cliente', type: 'string' as const, trust: 'trusted' as const }], containers: [{ ...blockDefinition.containers[0]!, items: [{ kind: 'textBlock' as const, id: 'dynamic', title: 'Nombre: {{customerName}}', text: 'Valor: {{customerName}}' }] }] };
    expect(collectDefinitionEditorErrors(dynamicBlock, 'Form').hasErrors).toBe(false);
    const invalidTemplate = { ...dynamicBlock, containers: [{ ...dynamicBlock.containers[0]!, items: [{ kind: 'textBlock' as const, id: 'dynamic', title: 'Nombre: {{missing}}', text: 'Valor' }] }] };
    expect(collectDefinitionEditorErrors(invalidTemplate, 'Form').textBlocks.dynamic?.title).toMatch(/no declarada/);
    const invalidBlock = { ...blockDefinition, containers: [{ ...blockDefinition.containers[0]!, items: [{ kind: 'textBlock' as const, id: 'bad', text: 'Ayuda', conditions: { visible: { logic: 'all' as const, rules: [{ source: { kind: 'external' as const, variable: 'missing' }, operator: 'equals' as const, value: 'x' }] } } }] }] };
    expect(collectDefinitionEditorErrors(invalidBlock, 'Form').containers.c1?.conditions).toMatch(/variable externa/);
  });
});

/**
 * Compatibilidad entre obligatoriedad fija y condicional. El editor ahora impide
 * llegar a la combinación, pero un borrador guardado antes de esta regla puede
 * traerla: hay que detectarla en vez de dejarla como algo que no se puede arreglar.
 */
describe('obligatoriedad fija frente a la condicional', () => {
  const gate = { id: 'gate', fieldName: 'gate', type: 'text' as const, label: 'Gate', width: 'full' as const, rules: {} };
  const pointsAtGate = { logic: 'all' as const, rules: [{ fieldId: 'gate', operator: 'notEmpty' as const }] };

  function build(target: Record<string, unknown>): FormDefinition {
    return {
      schemaVersion: 2,
      tipificationKey: 'generic@v1',
      title: 'Demo',
      submitLabel: 'Enviar',
      containers: [{
        id: 'c1',
        title: 'Uno',
        kind: 'section',
        columns: 1,
        fields: [gate, { id: 'f1', fieldName: 'campo', type: 'text', label: 'Campo', width: 'full', rules: {}, ...target }],
      }],
    } as FormDefinition;
  }

  it('marca el campo que tiene las dos formas de obligatoriedad', () => {
    const errors = collectDefinitionEditorErrors(build({ rules: { required: true }, conditions: { required: pointsAtGate } }), 'Demo');
    expect(errors.hasErrors).toBe(true);
    expect(errors.fields.f1?.conditions).toMatch(/no puede tener además obligatoriedad condicional/);
  });

  const permitidas: [string, Record<string, unknown>][] = [
    ['fija + visibilidad condicional', { rules: { required: true }, conditions: { visible: pointsAtGate } }],
    ['fija + habilitación condicional', { rules: { required: true }, conditions: { enabled: pointsAtGate } }],
    ['condicional sola', { conditions: { required: pointsAtGate } }],
  ];

  it.each(permitidas)('acepta %s', (_name, target) => {
    const errors = collectDefinitionEditorErrors(build(target), 'Demo');
    expect(errors.fields.f1).toBeUndefined();
    expect(errors.hasErrors).toBe(false);
  });
});
