// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FormDefinition } from '@tramites/form-contracts';
import type { DraftResponse, FormsApi, FormSummary } from '../api/forms-api';
import { useCmsWorkspace } from './use-cms-workspace';

function definition(title: string): FormDefinition {
  return {
    schemaVersion: 2,
    tipificationKey: 'generic@v1',
    title,
    submitLabel: 'Enviar',
    containers: [],
  };
}

function makeApi(): FormsApi {
  return {
    list: vi.fn(async (): Promise<FormSummary[]> => []),
    getDraft: vi.fn(async (formId: string): Promise<DraftResponse> => ({
      formId,
      name: `Form ${formId}`,
      definition: definition(`Title ${formId}`),
    })),
    create: vi.fn(),
    saveDraft: vi.fn(async () => {}),
    publish: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
  };
}

/**
 * Cambiar de formulario en la lista no puede tirar a la basura lo que se
 * estaba editando: se guarda en memoria y se restaura al volver, sin pedirle
 * de nuevo el borrador al servidor (que devolvería la versión vieja).
 */
describe('useCmsWorkspace: cambios sin guardar al cambiar de formulario', () => {
  it('conserva la edición al volver a seleccionar el formulario, sin volver a pedirlo al servidor', async () => {
    const api = makeApi();
    const { result } = renderHook(() => useCmsWorkspace(api));

    await act(async () => { await result.current.selectForm('a'); });
    expect(result.current.definition.title).toBe('Title a');

    act(() => { result.current.setDefinition({ ...result.current.definition, title: 'Editado sin guardar' }); });

    await act(async () => { await result.current.selectForm('b'); });
    expect(result.current.definition.title).toBe('Title b');

    vi.mocked(api.getDraft).mockClear();
    await act(async () => { await result.current.selectForm('a'); });

    expect(result.current.definition.title).toBe('Editado sin guardar');
    expect(api.getDraft).not.toHaveBeenCalled();
  });

  it('lo guardado sigue viéndose al volver, aunque ya no dependa del caché en memoria', async () => {
    const api = makeApi();
    const { result } = renderHook(() => useCmsWorkspace(api));

    await act(async () => { await result.current.selectForm('a'); });
    act(() => { result.current.setDefinition({ ...result.current.definition, title: 'Editado' }); });
    await act(async () => { await result.current.saveDraft(); });

    expect(api.saveDraft).toHaveBeenCalledWith('a', 'Form a', expect.objectContaining({ title: 'Editado' }));

    await act(async () => { await result.current.selectForm('b'); });
    await act(async () => { await result.current.selectForm('a'); });

    expect(result.current.definition.title).toBe('Editado');
  });

  it('no conserva nada la primera vez que se selecciona un formulario', async () => {
    const api = makeApi();
    const { result } = renderHook(() => useCmsWorkspace(api));

    await act(async () => { await result.current.selectForm('a'); });

    expect(api.getDraft).toHaveBeenCalledWith('a');
    expect(result.current.definition.title).toBe('Title a');
  });
});
