import type { FormDefinition } from '@tramites/form-contracts';
import { bffUrl } from '../../../shared/config/public-env';
import { ensureOk, readOkJson } from '../../../shared/lib/http';

export type FormSummary = {
  id: string;
  name: string;
  title: string;
  published: boolean;
  /** Un formulario pausado no entrega su definición publicada ni acepta submissions nuevas. */
  paused: boolean;
  pausedAt: string | null;
  updatedAt: string;
};

export type DraftResponse = {
  formId: string;
  name: string;
  definition: FormDefinition;
};

export interface FormsApi {
  list(): Promise<FormSummary[]>;
  getDraft(formId: string): Promise<DraftResponse>;
  create(name: string, definition: FormDefinition): Promise<FormSummary>;
  saveDraft(formId: string, name: string, definition: FormDefinition): Promise<void>;
  publish(formId: string): Promise<void>;
  pause(formId: string): Promise<void>;
  resume(formId: string): Promise<void>;
}

export function createFormsApi(baseUrl = bffUrl): FormsApi {
  const jsonHeaders = { 'content-type': 'application/json' };

  return {
    async list() {
      const response = await fetch(`${baseUrl}/forms`);
      return readOkJson<FormSummary[]>(response, 'No se pudieron listar los formularios');
    },
    async getDraft(formId) {
      const response = await fetch(`${baseUrl}/forms/${formId}/draft`);
      return readOkJson<DraftResponse>(response, 'No se pudo cargar el borrador');
    },
    async create(name, definition) {
      const response = await fetch(`${baseUrl}/forms`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ name, definition }),
      });
      return readOkJson<FormSummary>(response, 'No se pudo crear');
    },
    async saveDraft(formId, name, definition) {
      const response = await fetch(`${baseUrl}/forms/${formId}/draft`, {
        method: 'PUT',
        headers: jsonHeaders,
        body: JSON.stringify({ name, definition }),
      });
      await ensureOk(response, 'No se pudo guardar');
    },
    async publish(formId) {
      const response = await fetch(`${baseUrl}/forms/${formId}/publish`, { method: 'POST' });
      await ensureOk(response, 'No se pudo publicar');
    },
    async pause(formId) {
      const response = await fetch(`${baseUrl}/forms/${formId}/pause`, { method: 'POST' });
      await ensureOk(response, 'No se pudo pausar');
    },
    async resume(formId) {
      const response = await fetch(`${baseUrl}/forms/${formId}/resume`, { method: 'POST' });
      await ensureOk(response, 'No se pudo reactivar');
    },
  };
}

export const formsApi = createFormsApi();
