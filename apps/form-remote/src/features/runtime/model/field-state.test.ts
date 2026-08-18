import { describe, expect, it } from 'vitest';
import type { FormField } from '@tramites/form-contracts';
import { valuesByFieldId } from './field-state';

describe('valuesByFieldId', () => {
  it('maps payload keys back to internal field ids', () => {
    const field = { id: 'f1', fieldName: 'fullName', type: 'text', label: 'Nombre', width: 'full', rules: {} } as FormField;
    expect(valuesByFieldId(new Map([['f1', field]]), { fullName: 'Ana' })).toEqual({ f1: 'Ana' });
  });
});
