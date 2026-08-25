import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assertFormAvailable } from './form-availability';
import { UploadsService } from './uploads.service';
import type { FormsService } from './forms.service';
import type { SupabaseService } from './supabase.service';

const UPLOAD_FLAGS = ['FORM_UPLOADS_ENABLED', 'FORM_UPLOADS_AUTHENTICATED', 'FORM_UPLOADS_MALWARE_SCANNED'] as const;

describe('UploadsService · pausa', () => {
  beforeEach(() => {
    // Los adjuntos vienen deshabilitados por defecto y su guard corre antes que la
    // disponibilidad; hay que habilitarlos para llegar al chequeo de pausa.
    for (const flag of UPLOAD_FLAGS) process.env[flag] = 'true';
  });

  afterEach(() => {
    for (const flag of UPLOAD_FLAGS) delete process.env[flag];
  });

  it('no permite abrir una carga sobre un formulario pausado', async () => {
    const forms = {
      runtime: async () => {
        assertFormAvailable({ paused_at: '2026-08-20T22:00:00.000Z' });
        throw new Error('inalcanzable');
      },
    } as unknown as FormsService;

    const service = new UploadsService({} as unknown as SupabaseService, forms);

    await expect(
      service.createUpload('form-1', 'adjunto', { name: 'a.pdf', contentType: 'application/pdf', size: 10 }, 'sesion'),
    ).rejects.toMatchObject({
      response: { code: 'FORM_PAUSED', message: 'Este formulario no está disponible en este momento' },
    });
  });

  it('tampoco permite completar una carga ya iniciada', async () => {
    // La carga pudo abrirse antes de la pausa. Completarla no puede desembocar en
    // nada —la submission se rechaza igual— pero escribiría en storage y dejaría
    // la carga en `ready` sobre un formulario fuera de circulación.
    const updates: unknown[] = [];
    const forms = {
      runtime: async () => {
        assertFormAvailable({ paused_at: '2026-08-20T22:00:00.000Z' });
        throw new Error('inalcanzable');
      },
    } as unknown as FormsService;

    const supabase = {
      db: { from: () => ({ update: (payload: unknown) => { updates.push(payload); return { eq: () => Promise.resolve({ error: null }) }; } }) },
    } as unknown as SupabaseService;

    const service = new UploadsService(supabase, forms);

    await expect(service.completeUpload('form-1', 'upload-1', 'sesion')).rejects.toMatchObject({
      response: { code: 'FORM_PAUSED', message: 'Este formulario no está disponible en este momento' },
    });
    // El corte es antes de tocar la carga: no cambia de estado.
    expect(updates).toHaveLength(0);
  });
});
