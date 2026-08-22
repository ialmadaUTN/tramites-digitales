// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FormDefinition, SubmissionReceipt, UploadReference } from '@tramites/form-contracts';
import type { RuntimeApi } from '../api/runtime-api';
import { useRuntimeForm } from './use-runtime-form';

/**
 * Qué hace el runtime cuando el BFF responde 409 FORM_PAUSED. Lo que importa acá
 * es que el `code` sobreviva el viaje: sin él la UI no puede distinguir un
 * formulario pausado de una caída, y termina mostrando "no se pudo cargar".
 */

afterEach(cleanup);

const PAUSED_MESSAGE = 'Este formulario no está disponible en este momento';

const DEFINITION: FormDefinition = {
  schemaVersion: 2,
  tipificationKey: 'generic',
  title: 'Denuncia',
  submitLabel: 'Enviar',
  containers: [],
};

function pausedError() {
  return Object.assign(new Error(PAUSED_MESSAGE), { code: 'FORM_PAUSED' });
}

function fakeApi(overrides: Partial<RuntimeApi> = {}): () => RuntimeApi {
  const api: RuntimeApi = {
    loadForm: async () => ({ formId: 'form-1', version: 1, definition: DEFINITION, source: 'published' }),
    submit: async () => ({} as SubmissionReceipt),
    createUpload: async () => ({ uploadId: 'u', bucket: 'b', path: 'p', token: 't', expiresIn: 60 }),
    completeUpload: async () => ({} as UploadReference),
    ...overrides,
  };
  return () => api;
}

describe('useRuntimeForm · formulario pausado', () => {
  it('propaga el mensaje del BFF y el code al fallar la carga', async () => {
    const { result } = renderHook(() =>
      useRuntimeForm(
        { formId: 'form-1', apiBaseUrl: 'http://bff.test' },
        fakeApi({ loadForm: () => Promise.reject(pausedError()) }),
      ),
    );

    await waitFor(() => expect(result.current.loadError).not.toBeNull());
    expect(result.current.loadError).toEqual({ code: 'FORM_PAUSED', message: PAUSED_MESSAGE });
    expect(result.current.definition).toBeUndefined();
  });

  it('avisa al host con onError para que el portal pueda reaccionar', async () => {
    const onError = vi.fn();
    renderHook(() =>
      useRuntimeForm(
        { formId: 'form-1', apiBaseUrl: 'http://bff.test', onError },
        fakeApi({ loadForm: () => Promise.reject(pausedError()) }),
      ),
    );

    await waitFor(() => expect(onError).toHaveBeenCalledWith({ code: 'FORM_PAUSED', message: PAUSED_MESSAGE }));
  });

  it('un fallo de carga sin code queda como LOAD_ERROR', async () => {
    const { result } = renderHook(() =>
      useRuntimeForm(
        { formId: 'form-1', apiBaseUrl: 'http://bff.test' },
        fakeApi({ loadForm: () => Promise.reject(new Error('Se cayó la red')) }),
      ),
    );

    await waitFor(() => expect(result.current.loadError).not.toBeNull());
    expect(result.current.loadError).toEqual({ code: 'LOAD_ERROR', message: 'Se cayó la red' });
  });

  it('sesión ya iniciada: el formulario cargó antes de la pausa y el envío llega después', async () => {
    // El submit tiene que quedar con el code de pausa, no con SUBMIT_ERROR genérico.
    const { result } = renderHook(() =>
      useRuntimeForm(
        { formId: 'form-1', apiBaseUrl: 'http://bff.test' },
        fakeApi({ submit: () => Promise.reject(pausedError()) }),
      ),
    );

    await waitFor(() => expect(result.current.definition).toBeDefined());
    await result.current.submit({});

    await waitFor(() => expect(result.current.remoteError).not.toBeNull());
    expect(result.current.remoteError).toEqual({ code: 'FORM_PAUSED', message: PAUSED_MESSAGE });
  });

  it('carga normal cuando el formulario está disponible', async () => {
    const { result } = renderHook(() =>
      useRuntimeForm({ formId: 'form-1', apiBaseUrl: 'http://bff.test' }, fakeApi()),
    );

    await waitFor(() => expect(result.current.definition).toBeDefined());
    expect(result.current.loadError).toBeNull();
    expect(result.current.version).toBe(1);
  });
});
