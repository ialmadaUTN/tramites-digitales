// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FormDefinition } from '@tramites/form-contracts';
import type { FormsApi, FormSummary } from '../api/forms-api';
import { INITIAL_DEFINITION } from '../model/constants';
import { useCmsWorkspace } from './use-cms-workspace';

/**
 * El hook decide cuándo se puede guardar, publicar y pausar, y qué aviso ve el
 * autor. Estaba sin cubrir y es la deuda que marca `vitest.config.ts`.
 *
 * Se afirma sobre **qué le pide al API y qué estado deja**, no sobre el render:
 * una acción cableada al método equivocado no se nota mirando la pantalla.
 */

afterEach(cleanup);

const summary = (overrides: Partial<FormSummary> = {}): FormSummary => ({
  id: 'form-1',
  name: 'Denuncia',
  title: 'Denuncia',
  published: true,
  paused: false,
  pausedAt: null,
  updatedAt: '2026-08-21T00:00:00.000Z',
  ...overrides,
});

function fakeApi(overrides: Partial<FormsApi> = {}, forms: FormSummary[] = [summary()]) {
  const api: FormsApi = {
    list: vi.fn(async () => forms),
    getDraft: vi.fn(async () => ({ formId: 'form-1', name: 'Denuncia', definition: INITIAL_DEFINITION as FormDefinition })),
    create: vi.fn(async () => summary({ id: 'form-2', name: 'Nuevo formulario' })),
    saveDraft: vi.fn(async () => undefined),
    publish: vi.fn(async () => undefined),
    pause: vi.fn(async () => undefined),
    resume: vi.fn(async () => undefined),
    ...overrides,
  };
  return api;
}

/** Monta el hook y espera a que termine la carga inicial del listado. */
async function mount(api: FormsApi) {
  const view = renderHook(() => useCmsWorkspace(api));
  await waitFor(() => expect(view.result.current.forms).toHaveLength(1));
  return view;
}

describe('useCmsWorkspace · carga y selección', () => {
  it('carga el listado al montar', async () => {
    const api = fakeApi();
    const { result } = await mount(api);
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(result.current.forms[0]!.id).toBe('form-1');
  });

  it('avisa cuando la carga inicial falla', async () => {
    const api = fakeApi({ list: vi.fn(async () => { throw new Error('BFF caído'); }) });
    const { result } = renderHook(() => useCmsWorkspace(api));
    await waitFor(() => expect(result.current.status).toEqual({ text: 'BFF caído', error: true }));
  });

  it('seleccionar trae el borrador y lo deja en el editor', async () => {
    const api = fakeApi();
    const { result } = await mount(api);

    await act(async () => { await result.current.selectForm('form-1'); });

    expect(api.getDraft).toHaveBeenCalledWith('form-1');
    expect(result.current.selectedId).toBe('form-1');
    expect(result.current.name).toBe('Denuncia');
  });
});

describe('useCmsWorkspace · guardar y publicar', () => {
  it('no guarda si el editor tiene errores, y lo dice', async () => {
    const api = fakeApi();
    const { result } = await mount(api);
    await act(async () => { await result.current.selectForm('form-1'); });
    // Un nombre vacío es un error de editor.
    act(() => { result.current.setName(''); });

    let saved: boolean | undefined;
    await act(async () => { saved = await result.current.saveDraft(); });

    expect(saved).toBe(false);
    expect(api.saveDraft).not.toHaveBeenCalled();
    expect(result.current.status?.error).toBe(true);
  });

  it('guarda el borrador y refresca el listado', async () => {
    const api = fakeApi();
    const { result } = await mount(api);
    await act(async () => { await result.current.selectForm('form-1'); });

    await act(async () => { await result.current.saveDraft(); });

    expect(api.saveDraft).toHaveBeenCalledWith('form-1', 'Denuncia', expect.anything());
    expect(result.current.status).toEqual({ text: 'Borrador guardado' });
  });

  it('publicar guarda primero: si el guardado falla, no publica', async () => {
    const api = fakeApi({ saveDraft: vi.fn(async () => { throw new Error('sin conexión'); }) });
    const { result } = await mount(api);
    await act(async () => { await result.current.selectForm('form-1'); });

    await act(async () => { await result.current.publish(); });

    expect(api.publish).not.toHaveBeenCalled();
    expect(result.current.status?.error).toBe(true);
  });

  it('publica cuando el borrador está bien', async () => {
    const api = fakeApi();
    const { result } = await mount(api);
    await act(async () => { await result.current.selectForm('form-1'); });

    await act(async () => { await result.current.publish(); });

    expect(api.publish).toHaveBeenCalledWith('form-1');
    expect(result.current.status).toEqual({ text: 'Versión publicada' });
  });
});

describe('useCmsWorkspace · pausar y reactivar', () => {
  it('pausa un formulario disponible', async () => {
    const api = fakeApi();
    const { result } = await mount(api);
    await act(async () => { await result.current.selectForm('form-1'); });

    await act(async () => { await result.current.toggleAvailability(); });

    expect(api.pause).toHaveBeenCalledWith('form-1');
    expect(api.resume).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({ text: 'Formulario pausado' });
  });

  it('reactiva uno que ya estaba pausado', async () => {
    // La dirección sale del estado actual del formulario, no de un toggle local:
    // si se leyera al revés, pausar dos veces lo reactivaría.
    const api = fakeApi({}, [summary({ paused: true, pausedAt: '2026-08-21T00:00:00.000Z' })]);
    const { result } = await mount(api);
    await act(async () => { await result.current.selectForm('form-1'); });

    await act(async () => { await result.current.toggleAvailability(); });

    expect(api.resume).toHaveBeenCalledWith('form-1');
    expect(api.pause).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({ text: 'Formulario reactivado' });
  });

  it('sin formulario seleccionado no hace nada', async () => {
    const api = fakeApi();
    const { result } = await mount(api);

    await act(async () => { await result.current.toggleAvailability(); });

    expect(api.pause).not.toHaveBeenCalled();
    expect(api.resume).not.toHaveBeenCalled();
  });

  it('informa el error con la acción que se intentó', async () => {
    const api = fakeApi({ pause: vi.fn(async () => { throw new Error('409'); }) });
    const { result } = await mount(api);
    await act(async () => { await result.current.selectForm('form-1'); });

    await act(async () => { await result.current.toggleAvailability(); });

    expect(result.current.status).toEqual({ text: '409', error: true });
    expect(result.current.saving).toBe(false);
  });
});

describe('useCmsWorkspace · crear', () => {
  it('crea, refresca y deja seleccionado el nuevo', async () => {
    const api = fakeApi();
    const { result } = await mount(api);

    await act(async () => { await result.current.createForm(); });

    expect(api.create).toHaveBeenCalledWith('Nuevo formulario', INITIAL_DEFINITION);
    expect(result.current.selectedId).toBe('form-2');
    expect(result.current.status).toEqual({ text: 'Formulario creado' });
  });

  it('avisa si la creación falla', async () => {
    const api = fakeApi({ create: vi.fn(async () => { throw new Error('sin permisos'); }) });
    const { result } = await mount(api);

    await act(async () => { await result.current.createForm(); });

    expect(result.current.status).toEqual({ text: 'sin permisos', error: true });
    expect(result.current.saving).toBe(false);
  });
});
