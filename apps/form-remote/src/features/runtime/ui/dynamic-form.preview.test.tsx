// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formDefinitionSchema } from '@tramites/form-contracts';
import { DynamicForm } from './dynamic-form';

const mockRuntime = vi.hoisted(() => ({ current: undefined as any }));

vi.mock('../hooks/use-runtime-form', () => ({
  useRuntimeForm: () => mockRuntime.current,
}));
vi.mock('./fields/dynamic-field', () => ({
  DynamicField: () => <div data-testid="mock-field" />,
}));
vi.mock('./repeater/dynamic-repeater', () => ({
  DynamicRepeater: () => <div data-testid="mock-repeater" />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function definition() {
  return formDefinitionSchema.parse({
    schemaVersion: 3,
    tipificationKey: 'generic@v1',
    externalVariables: [{ name: 'insuranceCode', label: 'Código', type: 'string', trust: 'trusted' }],
    title: 'Preview',
    submitLabel: 'Enviar',
    conditions: {
      visible: {
        logic: 'all',
        rules: [{ source: { kind: 'external', variable: 'insuranceCode' }, operator: 'equals', value: '2050' }],
      },
    },
    containers: [{
      id: 'main',
      title: 'Datos',
      fields: [{ id: 'field-1', fieldName: 'name', type: 'text', label: 'Nombre', width: 'full', rules: {} }],
    }],
  });
}

function runtime(externalVariables: Record<string, unknown>) {
  const currentDefinition = definition();
  const firstField = currentDefinition.containers[0]!.fields[0]!;
  return {
    control: null,
    handleSubmit: () => (event: Event) => event.preventDefault(),
    values: { name: 'Ana' },
    errors: {},
    definition: currentDefinition,
    fieldMap: new Map([[firstField.id, firstField]]),
    version: 1,
    loadError: null,
    receipt: null,
    submitting: false,
    remoteError: null,
    submit: vi.fn(),
    uploadFile: undefined,
    externalVariables,
  };
}

describe('DynamicForm preview callback', () => {
  it('expone al CMS el estado efectivo y el payload limpio', async () => {
    const onPreviewStateChange = vi.fn();
    mockRuntime.current = runtime({ insuranceCode: '2050' });

    render(
      <DynamicForm
        formId="11111111-1111-4111-8111-111111111111"
        apiBaseUrl="http://localhost:3001"
        mode="draft"
        externalVariables={{ insuranceCode: '2050' }}
        onPreviewStateChange={onPreviewStateChange}
      />,
    );

    await waitFor(() => expect(onPreviewStateChange).toHaveBeenCalledWith({
      visible: true,
      enabled: true,
      included: true,
      payload: { name: 'Ana' },
    }));
  });

  it('recalcula el estado cuando cambia el contexto externo', async () => {
    const onPreviewStateChange = vi.fn();
    mockRuntime.current = runtime({ insuranceCode: '2050' });
    const view = render(
      <DynamicForm
        formId="11111111-1111-4111-8111-111111111111"
        apiBaseUrl="http://localhost:3001"
        mode="draft"
        externalVariables={{ insuranceCode: '2050' }}
        onPreviewStateChange={onPreviewStateChange}
      />,
    );
    await waitFor(() => expect(onPreviewStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ visible: true })));

    mockRuntime.current = runtime({ insuranceCode: '9999' });
    view.rerender(
      <DynamicForm
        formId="11111111-1111-4111-8111-111111111111"
        apiBaseUrl="http://localhost:3001"
        mode="draft"
        externalVariables={{ insuranceCode: '9999' }}
        onPreviewStateChange={onPreviewStateChange}
      />,
    );

    await waitFor(() => expect(onPreviewStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ visible: false, payload: {} })));
  });
});
