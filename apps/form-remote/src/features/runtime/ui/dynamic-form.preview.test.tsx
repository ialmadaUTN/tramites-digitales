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

function runtimeWithBlock(externalVariables: Record<string, unknown>, hidden = false) {
  const currentDefinition = definition();
  const container = currentDefinition.containers[0]!;
  const field = container.fields[0]!;
  const block = {
    id: 'info',
    kind: 'textBlock' as const,
    title: '{{customerName}}',
    text: 'Cliente: {{customerName}}',
    ...(hidden ? { conditions: { visible: { logic: 'all' as const, rules: [{ source: { kind: 'external' as const, variable: 'insuranceCode' }, operator: 'equals' as const, value: 'never' }] } } } : {}),
  };
  currentDefinition.containers[0] = { ...container, items: [{ kind: 'field', field }, block] };
  return { ...runtime(externalVariables), definition: currentDefinition, fieldMap: new Map([[field.id, field]]) };
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

  it('resuelve título y contenido de un bloque visible sin crear controles', () => {
    const onError = vi.fn();
    mockRuntime.current = runtimeWithBlock({ insuranceCode: '2050', customerName: 'Ignacio' });
    const { container } = render(
      <DynamicForm formId="11111111-1111-4111-8111-111111111111" apiBaseUrl="http://localhost:3001" externalVariables={{ insuranceCode: '2050', customerName: 'Ignacio' }} onError={onError} />,
    );
    expect(container.querySelector('h3')?.textContent).toBe('Ignacio');
    expect(container.querySelector('.form-info-block p')?.textContent).toBe('Cliente: Ignacio');
    expect(container.querySelector('.form-info-block input')).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it('renderiza valores estáticos como texto de solo lectura', () => {
    const currentDefinition = definition();
    const containerDefinition = currentDefinition.containers[0]!;
    const field = containerDefinition.fields[0]!;
    currentDefinition.containers[0] = { ...containerDefinition, items: [{ kind: 'field', field }, { id: 'static', kind: 'textBlock', title: 'Nombre', text: 'Ignacio Almada' }] };
    mockRuntime.current = { ...runtime({ insuranceCode: '2050' }), definition: currentDefinition };
    const { container } = render(
      <DynamicForm formId="11111111-1111-4111-8111-111111111111" apiBaseUrl="http://localhost:3001" externalVariables={{ insuranceCode: '2050' }} />,
    );
    expect(container.querySelector('.form-info-block h3')?.textContent).toBe('Nombre');
    expect(container.querySelector('.form-info-block p')?.textContent).toBe('Ignacio Almada');
  });

  it('muestra error general y notifica cuando falta una variable visible', () => {
    const onError = vi.fn();
    mockRuntime.current = runtimeWithBlock({ insuranceCode: '2050' });
    render(
      <DynamicForm formId="11111111-1111-4111-8111-111111111111" apiBaseUrl="http://localhost:3001" externalVariables={{ insuranceCode: '2050' }} onError={onError} />,
    );
    expect(document.body.textContent).toContain('Faltan variables externas: customerName');
    expect(onError).toHaveBeenCalledWith({ code: 'MISSING_EXTERNAL_VARIABLE', message: 'Faltan variables externas: customerName' });
  });

  it('no exige variables de un bloque oculto', () => {
    const onError = vi.fn();
    mockRuntime.current = runtimeWithBlock({ insuranceCode: '2050' }, true);
    render(
      <DynamicForm formId="11111111-1111-4111-8111-111111111111" apiBaseUrl="http://localhost:3001" externalVariables={{ insuranceCode: '2050' }} onError={onError} />,
    );
    expect(document.body.textContent).not.toContain('Faltan variables externas');
    expect(onError).not.toHaveBeenCalled();
    expect(document.querySelector('.form-info-block')).toBeNull();
  });

  it('renderiza HTML como texto literal', () => {
    const onError = vi.fn();
    mockRuntime.current = runtimeWithBlock({ insuranceCode: '2050', customerName: '<img src=x onerror=alert(1)>' });
    const { container } = render(
      <DynamicForm formId="11111111-1111-4111-8111-111111111111" apiBaseUrl="http://localhost:3001" externalVariables={{ insuranceCode: '2050', customerName: '<img src=x onerror=alert(1)>' }} onError={onError} />,
    );
    expect(container.querySelector('.form-info-block p')?.textContent).toBe('Cliente: <img src=x onerror=alert(1)>');
    expect(container.querySelector('.form-info-block img')).toBeNull();
  });
});
