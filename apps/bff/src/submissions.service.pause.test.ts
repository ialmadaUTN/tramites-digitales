import { describe, expect, it } from 'vitest';
import { assertFormAvailable } from './form-availability';
import { SubmissionsService } from './submissions.service';
import type { DynamicsClient } from './dynamics.client';
import type { FormsService } from './forms.service';
import type { SupabaseService } from './supabase.service';
import type { TipificationRegistry } from './tipification.registry';
import type { UploadsService } from './uploads.service';

const DEFINITION = {
  schemaVersion: 2 as const,
  tipificationKey: 'generic',
  title: 'Denuncia',
  submitLabel: 'Enviar',
  containers: [],
};

const EXISTING_SUBMISSION = {
  id: 5,
  public_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  form_id: 1,
  form_version_id: 10,
  idempotency_key: 'key-original',
  payload: {},
  delivery_status: 'delivered' as const,
  delivery_attempts: 1,
  last_delivery_error: null,
  external_response: null,
  submitted_at: '2026-08-20T22:00:00.000Z',
  created_at: '2026-08-20T22:00:00.000Z',
  updated_at: '2026-08-20T22:00:00.000Z',
};

function makeService(options: { paused: boolean; existingKey?: string }) {
  const inserts: unknown[] = [];

  const supabase = {
    db: {
      from(table: string) {
        const filters: Record<string, unknown> = {};

        const resolve = () => {
          if (table === 'form_versions') return { version_number: 3, definition: DEFINITION, id: 10 };
          if (table === 'forms') return { public_id: 'form-1' };
          // submissions: por public_id siempre existe; por idempotency_key sólo si el caso lo pide.
          if ('public_id' in filters) return { ...EXISTING_SUBMISSION };
          if ('idempotency_key' in filters) {
            return options.existingKey === filters.idempotency_key ? { ...EXISTING_SUBMISSION } : null;
          }
          return { ...EXISTING_SUBMISSION };
        };

        const api: Record<string, unknown> = {
          select: () => api,
          eq: (column: string, value: unknown) => {
            filters[column] = value;
            return api;
          },
          update: () => api,
          insert: (payload: unknown) => {
            inserts.push(payload);
            return api;
          },
          single: () => Promise.resolve({ data: resolve(), error: null }),
          maybeSingle: () => Promise.resolve({ data: resolve(), error: null }),
        };
        return api;
      },
    },
  } as unknown as SupabaseService;

  // FormsService falso que aplica la regla real de disponibilidad.
  const forms = {
    findForm: async () => ({ id: 1, public_id: 'form-1', paused_at: options.paused ? '2026-08-20T22:00:00.000Z' : null }),
    runtime: async () => {
      assertFormAvailable({ paused_at: options.paused ? '2026-08-20T22:00:00.000Z' : null });
      return { formId: 'form-1', version: 3, definition: DEFINITION, source: 'published' as const };
    },
  } as unknown as FormsService;

  const service = new SubmissionsService(
    supabase,
    forms,
    { deliver: async () => ({ status: 'delivered' as const }) } as unknown as DynamicsClient,
    { map: (_key: string, input: { data: unknown }) => input.data } as unknown as TipificationRegistry,
    { assertSubmissionUploads: async () => undefined, attachToSubmission: async () => undefined } as unknown as UploadsService,
  );

  return { service, inserts };
}

describe('SubmissionsService · pausa', () => {
  it('rechaza una submission nueva sobre un formulario pausado y no escribe nada', async () => {
    const { service, inserts } = makeService({ paused: true });

    await expect(service.submit('form-1', 3, {}, 'key-nueva', 'sesion')).rejects.toMatchObject({
      response: { code: 'FORM_PAUSED', message: 'Este formulario no está disponible en este momento' },
    });
    expect(inserts).toHaveLength(0);
  });

  it('devuelve el receipt original ante un reintento con la misma Idempotency-Key, aunque se haya pausado en el medio', async () => {
    // El caso real: se envió con el formulario activo, se perdió la respuesta por timeout,
    // se pausó, y el cliente reintenta. Responder "pausado" le haría creer que se perdió
    // algo que sí se guardó.
    const { service, inserts } = makeService({ paused: true, existingKey: 'key-original' });

    const receipt = await service.submit('form-1', 3, {}, 'key-original', 'sesion');

    expect(receipt.submissionId).toBe(EXISTING_SUBMISSION.public_id);
    expect(receipt.formVersion).toBe(3);
    expect(inserts).toHaveLength(0);
  });

  it('acepta una submission nueva cuando el formulario no está pausado', async () => {
    const { service, inserts } = makeService({ paused: false });

    const receipt = await service.submit('form-1', 3, {}, 'key-nueva', 'sesion');

    expect(receipt.submissionId).toBe(EXISTING_SUBMISSION.public_id);
    expect(inserts).toHaveLength(1);
  });

  it('el reintento de entrega de una submission ya aceptada sigue permitido con el formulario pausado', async () => {
    // Reintentar la entrega a Dynamics no es iniciar una submission nueva: lo que se
    // reintenta ya fue aceptado y el cliente ya tiene su número de gestión.
    const { service } = makeService({ paused: true });

    const receipt = await service.retry(EXISTING_SUBMISSION.public_id);

    expect(receipt.submissionId).toBe(EXISTING_SUBMISSION.public_id);
  });
});
