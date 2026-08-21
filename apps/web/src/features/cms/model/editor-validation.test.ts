import { describe, expect, it } from 'vitest';
import type { FormDefinition } from '@tramites/form-contracts';
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
