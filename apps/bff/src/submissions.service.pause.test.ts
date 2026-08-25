import { describe, expect, it, vi } from 'vitest';
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

function makeService(options: { paused: boolean; existingKey?: string; insertError?: { code: string; message: string } }) {
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

        let inserting = false;

        /** El insert de `submissions` puede fallar por el trigger de disponibilidad. */
        const settle = () => {
          if (inserting && table === 'submissions' && options.insertError) {
            return { data: null, error: options.insertError };
          }
          return { data: resolve(), error: null };
        };

        const api: Record<string, unknown> = {
          select: () => api,
          eq: (column: string, value: unknown) => {
            filters[column] = value;
            return api;
          },
          update: () => api,
          insert: (payload: unknown) => {
            inserting = true;
            inserts.push(payload);
            return api;
          },
          single: () => Promise.resolve(settle()),
          maybeSingle: () => Promise.resolve(settle()),
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

  const deliver = vi.fn(async () => ({ status: 'delivered' as const }));
  const attachToSubmission = vi.fn(async () => undefined);

  const service = new SubmissionsService(
    supabase,
    forms,
    { deliver } as unknown as DynamicsClient,
    { map: (_key: string, input: { data: unknown }) => input.data } as unknown as TipificationRegistry,
    { assertSubmissionUploads: async () => undefined, attachToSubmission } as unknown as UploadsService,
  );

  return { service, inserts, deliver, attachToSubmission };
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

/**
 * La carrera entre la pausa y el alta de la submission.
 *
 * El chequeo de disponibilidad del servicio corre varias operaciones de I/O
 * antes del insert —token de contexto, validación, versión, adjuntos— así que no
 * puede ser atómico. La decisión final la toma el trigger de la base, dentro de
 * la misma transacción, y acá se verifica que el BFF la traduzca bien.
 */
describe('SubmissionsService · pausa durante el insert', () => {
  const triggerError = { code: 'TD001', message: 'Este formulario no está disponible en este momento' };

  it('traduce el rechazo del trigger al mismo 409 que el chequeo previo', async () => {
    // El formulario estaba disponible al validar y se pausó antes del insert.
    const { service } = makeService({ paused: false, insertError: triggerError });

    await expect(service.submit('form-1', 3, {}, 'key-carrera', 'sesion')).rejects.toMatchObject({
      response: { code: 'FORM_PAUSED', message: 'Este formulario no está disponible en este momento' },
    });
  });

  it('no deja la gestión a medias: no adjunta los archivos ni entrega a Dynamics', async () => {
    // Si el rechazo del trigger no cortara el flujo, se entregaría a Dynamics una
    // gestión que la base nunca aceptó.
    const { service, deliver, attachToSubmission } = makeService({ paused: false, insertError: triggerError });

    await service.submit('form-1', 3, {}, 'key-carrera', 'sesion').catch(() => undefined);

    expect(attachToSubmission).not.toHaveBeenCalled();
    expect(deliver).not.toHaveBeenCalled();
  });

  it('un error de insert que no es la pausa no se disfraza de 409', async () => {
    // Enmascarar cualquier fallo como "pausado" escondería incidentes reales.
    const { service } = makeService({ paused: false, insertError: { code: '23503', message: 'violación de clave foránea' } });

    await expect(service.submit('form-1', 3, {}, 'key-otra', 'sesion')).rejects.toThrow(/clave foránea/);
  });
});
