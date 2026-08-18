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
