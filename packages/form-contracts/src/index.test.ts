import { describe, expect, it } from 'vitest';
import { FIELD_NAME_INVALID_MESSAGE, fieldNameError } from './field-name';
import { cleanSubmissionPayload, evaluateCondition, validateDefinition } from './index';
import { validateSubmission } from './validation';

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
});
