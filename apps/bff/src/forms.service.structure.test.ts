import { describe, expect, it } from 'vitest';
import { FormsService } from './forms.service';
import { TipificationRegistry } from './tipification.registry';
import type { SupabaseService } from './supabase.service';

/**
 * Completitud estructural en el BFF: publicar exige un formulario completo,
 * guardar y **leer** no. Ese último punto es el que importa: `parseDefinition`
 * corre en `list()` por cada formulario, así que si el esquema base rechazara
 * lo incompleto, un solo borrador vacío dejaría al CMS sin sidebar.
 */

const FIELD = { id: 'f1', fieldName: 'nombre', type: 'text', label: 'Nombre', width: 'full', rules: {} };

const complete = {
  schemaVersion: 2,
  tipificationKey: 'generic@v1',
  title: 'Denuncia',
  submitLabel: 'Enviar',
  containers: [{ id: 'c1', title: 'Datos', kind: 'section', columns: 1, fields: [FIELD] }],
};

const emptyContainer = { ...complete, containers: [{ id: 'c1', title: 'Datos', kind: 'section', columns: 1, fields: [] }] };
const emptyRepeater = { ...complete, containers: [{ id: 'r1', title: 'Grilla', kind: 'repeater', fieldName: 'filas', columns: 1, fields: [] }] };
const noContainers = { ...complete, containers: [] };

function makeService(draft: unknown) {
  const versionInserts: unknown[] = [];
  const form = {
    id: 1,
    public_id: '11111111-1111-4111-8111-111111111111',
    name: 'Denuncia',
    draft_definition: draft,
    published_version_id: null as number | null,
    paused_at: null,
    created_at: 'now',
    updated_at: 'now',
  };

  const supabase = {
    db: {
      from(table: string) {
        const state: { action: 'select' | 'insert' | 'update' } = { action: 'select' };
        const row = () => {
          if (table === 'forms') return { ...form };
          if (state.action === 'insert') return { id: 99, form_id: 1, version_number: 1, definition: draft, created_at: 'now' };
          return null;
        };
        const api: Record<string, unknown> = {
          select: () => api,
          eq: () => api,
          order: () => api,
          limit: () => api,
          update: () => { state.action = 'update'; return api; },
          insert: (payload: unknown) => {
            state.action = 'insert';
            if (table === 'form_versions') versionInserts.push(payload);
            return api;
          },
          single: () => Promise.resolve({ data: row(), error: null }),
          maybeSingle: () => Promise.resolve({ data: row(), error: null }),
          then: (onOk: (value: { data: unknown[]; error: null }) => unknown) =>
            Promise.resolve({ data: [{ ...form }], error: null }).then(onOk),
        };
        return api;
      },
    },
  } as unknown as SupabaseService;

  return { service: new FormsService(supabase, new TipificationRegistry()), versionInserts };
}

describe('FormsService · completitud estructural', () => {
  const invalid: Array<[string, unknown, RegExp]> = [
    ['formulario sin contenedores', noContainers, /al menos un contenedor/],
    ['contenedor sin campos', emptyContainer, /al menos un campo/],
    ['grilla sin columnas', emptyRepeater, /al menos una columna/],
  ];

  it.each(invalid)('publicar rechaza: %s', async (_name, draft) => {
    const { service } = makeService(draft);
    await expect(service.publish('11111111-1111-4111-8111-111111111111')).rejects.toMatchObject({
      response: { code: 'VALIDATION_ERROR' },
    });
  });

  it.each(invalid)('y no crea la versión: %s', async (_name, draft) => {
    // La mitad que se olvida: rechazar sin dejar una versión huérfana publicada.
    const { service, versionInserts } = makeService(draft);
    await service.publish('11111111-1111-4111-8111-111111111111').catch(() => undefined);
    expect(versionInserts).toHaveLength(0);
  });

  it('publicar acepta un formulario completo y crea la versión', async () => {
    const { service, versionInserts } = makeService(complete);
    const result = await service.publish('11111111-1111-4111-8111-111111111111');
    expect(result.version).toBe(1);
    expect(versionInserts).toHaveLength(1);
  });

  it.each(invalid)('guardar el borrador sigue permitido: %s', async (_name, draft) => {
    const { service } = makeService(complete);
    await expect(service.updateDraft('11111111-1111-4111-8111-111111111111', { definition: draft })).resolves.toBeDefined();
  });

  it.each(invalid)('leer no se rompe con un borrador incompleto ya guardado: %s', async (_name, draft) => {
    // Si esto falla, un único borrador vacío deja al CMS sin listado y sin forma
    // de entrar a arreglarlo.
    const { service } = makeService(draft);
    await expect(service.list()).resolves.toHaveLength(1);
    await expect(service.getDraft('11111111-1111-4111-8111-111111111111')).resolves.toBeDefined();
  });
});
