// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state: { loadError: { code: string; message: string } | null } = { loadError: null };

vi.mock('../hooks/use-runtime-form', () => ({
  useRuntimeForm: () => ({
    loadError: state.loadError,
    definition: undefined,
    fieldMap: new Map(),
    values: {},
    errors: {},
    control: {},
    handleSubmit: () => () => {},
    submit: () => {},
    receipt: null,
    submitting: false,
    remoteError: null,
    version: null,
    uploadFile: undefined,
  }),
}));

const { DynamicForm } = await import('./dynamic-form');

const PAUSED_MESSAGE = 'Este formulario no está disponible en este momento';

afterEach(cleanup);

describe('DynamicForm · pantalla de formulario pausado', () => {
  it('muestra el mensaje exacto y no el JSON crudo del error', () => {
    state.loadError = { code: 'FORM_PAUSED', message: PAUSED_MESSAGE };
    const { container } = render(<DynamicForm formId="form-1" apiBaseUrl="http://bff.test" />);

    expect(screen.getByText(PAUSED_MESSAGE)).toBeTruthy();
    // Una pausa no es una falla técnica: el encabezado la distingue de un error de carga.
    expect(screen.getByText('Formulario no disponible')).toBeTruthy();
    expect(container.textContent).not.toContain('FORM_PAUSED');
  });

  it('un fallo real conserva el encabezado de error', () => {
    state.loadError = { code: 'LOAD_ERROR', message: 'Se cayó la red' };
    render(<DynamicForm formId="form-1" apiBaseUrl="http://bff.test" />);

    expect(screen.getByText('No se pudo cargar')).toBeTruthy();
    expect(screen.getByText('Se cayó la red')).toBeTruthy();
  });
});
