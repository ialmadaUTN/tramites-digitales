import type { RuntimeFormResponse, SubmissionReceipt, UploadReference } from '@tramites/form-contracts';
import { joinUrl } from '../../../shared/lib/http';

export type SubmitInput = {
  version: number;
  payload: Record<string, unknown>;
  contextToken?: string;
};

export type UploadTicket = { uploadId: string; bucket: string; path: string; token: string; expiresIn: number };
export type UploadInput = { fieldName: string; name: string; contentType: string; size: number };

export interface RuntimeApi {
  loadForm(formId: string, mode: 'published' | 'draft'): Promise<RuntimeFormResponse>;
  submit(formId: string, input: SubmitInput, uploadSession: string): Promise<SubmissionReceipt>;
  createUpload(formId: string, input: UploadInput, uploadSession: string): Promise<UploadTicket>;
  completeUpload(formId: string, uploadId: string, uploadSession: string): Promise<UploadReference>;
}

/**
 * El BFF responde los errores como `{ code, message }`. Tirar `response.text()` crudo
 * dejaba el JSON entero en pantalla; lo que se muestra tiene que ser el `message`,
 * y el `code` viaja aparte para que la UI pueda distinguir casos como FORM_PAUSED.
 */
export async function toApiError(response: Response, fallback: string): Promise<Error & { code?: string }> {
  const body = (await response.json().catch(() => undefined)) as { code?: string; message?: string } | undefined;
  return Object.assign(new Error(body?.message ?? fallback), { code: body?.code, details: body });
}

export function createRuntimeApi(apiBaseUrl: string): RuntimeApi {
  return {
    async loadForm(formId, mode) {
      const response = await fetch(joinUrl(apiBaseUrl, `runtime/forms/${formId}?mode=${mode}`));
      if (!response.ok) throw await toApiError(response, 'No se pudo cargar el formulario');
      return response.json() as Promise<RuntimeFormResponse>;
    },
    async submit(formId, input, uploadSession) {
      const response = await fetch(joinUrl(apiBaseUrl, `runtime/forms/${formId}/submissions`), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'Idempotency-Key': crypto.randomUUID(), 'X-Upload-Session': uploadSession, ...(input.contextToken ? { 'X-Form-Context': input.contextToken } : {}) },
        body: JSON.stringify({ version: input.version, payload: input.payload }),
      });
      if (!response.ok) throw await toApiError(response, 'No se pudo enviar el formulario');
      return (await response.json()) as SubmissionReceipt;
    },
    async createUpload(formId, input, uploadSession) {
      const response = await fetch(joinUrl(apiBaseUrl, `runtime/forms/${formId}/uploads`), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'X-Upload-Session': uploadSession },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw await toApiError(response, 'No se pudo completar la operación');
      return response.json() as Promise<UploadTicket>;
    },
    async completeUpload(formId, uploadId, uploadSession) {
      const response = await fetch(joinUrl(apiBaseUrl, `runtime/forms/${formId}/uploads/${uploadId}/complete`), {
        method: 'POST',
        headers: { 'X-Upload-Session': uploadSession },
      });
      if (!response.ok) throw await toApiError(response, 'No se pudo completar la operación');
      return response.json() as Promise<UploadReference>;
    },
  };
}
