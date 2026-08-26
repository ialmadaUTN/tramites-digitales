// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FormDefinition } from '@tramites/form-contracts';

vi.mock('./fields/dynamic-field', () => ({
  DynamicField: ({ field }: { field: { id: string } }) => <div data-testid={`field-${field.id}`} />,
}));

const state: { definition: FormDefinition | undefined } = { definition: undefined };

vi.mock('../hooks/use-runtime-form', () => ({
  useRuntimeForm: () => ({
    loadError: null,
    definition: state.definition,
    fieldMap: new Map(),
    values: {},
    errors: {},
    control: {},
    handleSubmit: () => () => {},
    submit: () => {},
    receipt: null,
    submitting: false,
    remoteError: null,
    version: 1,
    uploadFile: undefined,
  }),
}));

const { DynamicForm } = await import('./dynamic-form');

afterEach(cleanup);

function definitionWithColumns(columns: 1 | 2 | 3 | 4): FormDefinition {
  return {
    title: 'Demo',
    submitLabel: 'Enviar',
    containers: [{
      id: 'c1',
      title: 'Uno',
      columns,
      fields: [{ id: 'f1', fieldName: 'a', type: 'text', label: 'A', width: 'full', rules: {} }],
    }],
  };
}

describe('DynamicForm · distribución en columnas', () => {
  it.each([1, 2, 3, 4] as const)('aplica la clase columns-%s según container.columns', (columns) => {
    state.definition = definitionWithColumns(columns);
    const { container } = render(<DynamicForm formId="form-1" apiBaseUrl="http://bff.test" />);

    const grid = container.querySelector('.field-grid');
    expect(grid?.className).toBe(`field-grid columns-${columns}`);
  });
});
