import { describe, expect, it } from 'vitest';
import { FormsService } from './forms.service';
import { TipificationRegistry } from './tipification.registry';
import type { SupabaseService } from './supabase.service';

// Estructuralmente completa: `publish()` valida completitud, y a estos casos les
// interesa la pausa, no la estructura (eso se cubre en `forms.service.structure.test.ts`).
const DEFINITION = {
  schemaVersion: 2 as const,
  tipificationKey: 'generic',
  title: 'Denuncia',
  submitLabel: 'Enviar',
  containers: [{
    id: 'c1',
    title: 'Datos',
    kind: 'section' as const,
    columns: 1 as const,
    fields: [{ id: 'f1', fieldName: 'nombre', type: 'text' as const, label: 'Nombre', width: 'full' as const, rules: {} }],
  }],
};

type FormRecord = {
  id: number;
  public_id: string;
  name: string;
  draft_definition: unknown;
  published_version_id: number | null;
  paused_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Supabase falso, sólo lo que estos casos ejercitan. No pretende ser un motor SQL:
 * el recorrido real contra la base lo verifica el e2e. Acá interesa la decisión de
 * disponibilidad, que es lógica de negocio.
 */
function fakeSupabase(form: FormRecord) {
  const versions = [{ id: 10, form_id: form.id, version_number: 3, definition: DEFINITION, created_at: 'now' }];

  function chain(table: string) {
    const state: { action: 'select' | 'update' | 'insert'; payload: Record<string, unknown> } = { action: 'select', payload: {} };

    const row = () => {
      if (table === 'forms') {
        if (state.action === 'update') Object.assign(form, state.payload);
        return { ...form };
      }
      if (state.action === 'insert') {
        const inserted = { id: 11, form_id: form.id, version_number: 4, definition: DEFINITION, created_at: 'now' };
        versions.push(inserted);
        return inserted;
      }
      return { ...versions[versions.length - 1] };
    };

    const api: Record<string, unknown> = {
      select: () => api,
      eq: () => api,
      order: () => api,
      limit: () => api,
      update: (payload: Record<string, unknown>) => {
        state.action = 'update';
        state.payload = payload;
        return api;
      },
      insert: (payload: Record<string, unknown>) => {
        state.action = 'insert';
        state.payload = payload;
        return api;
      },
      single: () => Promise.resolve({ data: row(), error: null }),
      maybeSingle: () => Promise.resolve({ data: row(), error: null }),
      // list() no cierra con single(): espera el builder directo y recibe un array.
      then: (onOk: (value: { data: unknown[]; error: null }) => unknown) =>
        Promise.resolve({ data: [row()], error: null }).then(onOk),
    };
    return api;
  }

  return { db: { from: (table: string) => chain(table) } } as unknown as SupabaseService;
}

function makeForm(overrides: Partial<FormRecord> = {}): FormRecord {
  return {
    id: 1,
    public_id: '11111111-1111-4111-8111-111111111111',
    name: 'Denuncia',
    draft_definition: DEFINITION,
    published_version_id: 10,
    paused_at: null,
    created_at: 'now',
    updated_at: 'now',
    ...overrides,
  };
}

function makeService(form: FormRecord) {
  return new FormsService(fakeSupabase(form), new TipificationRegistry());
}

describe('FormsService · pausa', () => {
  it('no entrega la definición publicada de un formulario pausado', async () => {
    const service = makeService(makeForm({ paused_at: '2026-08-20T22:00:00.000Z' }));
    await expect(service.runtime('11111111-1111-4111-8111-111111111111', 'published')).rejects.toMatchObject({
      response: { code: 'FORM_PAUSED', message: 'Este formulario no está disponible en este momento' },
    });
  });

  it('sí entrega el borrador de un formulario pausado: la preview del CMS tiene que seguir andando', async () => {
    const service = makeService(makeForm({ paused_at: '2026-08-20T22:00:00.000Z' }));
    const runtime = await service.runtime('11111111-1111-4111-8111-111111111111', 'draft');
    expect(runtime.source).toBe('draft');
    expect(runtime.definition.title).toBe('Denuncia');
  });

  it('entrega la definición publicada cuando no está pausado', async () => {
    const service = makeService(makeForm());
    const runtime = await service.runtime('11111111-1111-4111-8111-111111111111', 'published');
    expect(runtime.source).toBe('published');
    expect(runtime.version).toBe(3);
  });

  it('pause marca paused_at y resume lo vuelve a null', async () => {
    const form = makeForm();
    const service = makeService(form);

    const paused = await service.pause(form.public_id);
    expect(paused.paused).toBe(true);
    expect(form.paused_at).not.toBeNull();

    const resumed = await service.resume(form.public_id);
    expect(resumed.paused).toBe(false);
    expect(form.paused_at).toBeNull();
  });

  it('pausar dos veces no corre la marca original', async () => {
    const form = makeForm({ paused_at: '2026-08-20T22:00:00.000Z' });
    const service = makeService(form);
    await service.pause(form.public_id);
    expect(form.paused_at).toBe('2026-08-20T22:00:00.000Z');
  });

  it('reactivar algo que no estaba pausado no rompe', async () => {
    const form = makeForm();
    const service = makeService(form);
    const summary = await service.resume(form.public_id);
    expect(summary.paused).toBe(false);
  });

  it('el resumen expone el estado para que el listado del CMS lo pueda mostrar', async () => {
    const service = makeService(makeForm({ paused_at: '2026-08-20T22:00:00.000Z' }));
    const [summary] = await service.list();
    expect(summary).toMatchObject({ published: true, paused: true, pausedAt: '2026-08-20T22:00:00.000Z' });
  });

  it('publicar una versión nueva NO reactiva un formulario pausado', async () => {
    const form = makeForm({ paused_at: '2026-08-20T22:00:00.000Z' });
    const service = makeService(form);
    await service.publish(form.public_id);
    // Reactivar por efecto secundario de otra acción es cómo se expone un formulario sin querer.
    expect(form.paused_at).toBe('2026-08-20T22:00:00.000Z');
  });
});
