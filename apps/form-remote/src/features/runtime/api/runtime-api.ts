import type { RuntimeFormResponse, SubmissionReceipt, UploadReference } from '@tramites/form-contracts';
import { joinUrl } from '../../../shared/lib/http';

export type SubmitInput = {
  version: number;
  payload: Record<string, unknown>;
};

export type UploadTicket = { uploadId: string; bucket: string; path: string; token: string; expiresIn: number };
export type UploadInput = { fieldName: string; name: string; contentType: string; size: number };

export interface RuntimeApi {
  loadForm(formId: string, mode: 'published' | 'draft'): Promise<RuntimeFormResponse>;
  submit(formId: string, input: SubmitInput, uploadSession: string): Promise<SubmissionReceipt>;
  createUpload(formId: string, input: UploadInput, uploadSession: string): Promise<UploadTicket>;
  completeUpload(formId: string, uploadId: string, uploadSession: string): Promise<UploadReference>;
}

export function createRuntimeApi(apiBaseUrl: string): RuntimeApi {
  return {
    async loadForm(formId, mode) {
      const response = await fetch(joinUrl(apiBaseUrl, `runtime/forms/${formId}?mode=${mode}`));
      if (!response.ok) throw new Error(await response.text());
      return response.json() as Promise<RuntimeFormResponse>;
    },
    async submit(formId, input, uploadSession) {
      const response = await fetch(joinUrl(apiBaseUrl, `runtime/forms/${formId}/submissions`), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'Idempotency-Key': crypto.randomUUID(), 'X-Upload-Session': uploadSession },
        body: JSON.stringify(input),
      });
      const body = await response.json().catch(() => undefined);
      if (!response.ok) {
        throw Object.assign(new Error((body as { message?: string } | undefined)?.message ?? 'No se pudo enviar el formulario'), { details: body });
      }
      return body as SubmissionReceipt;
    },
    async createUpload(formId, input, uploadSession) {
      const response = await fetch(joinUrl(apiBaseUrl, `runtime/forms/${formId}/uploads`), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'X-Upload-Session': uploadSession },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json() as Promise<UploadTicket>;
    },
    async completeUpload(formId, uploadId, uploadSession) {
      const response = await fetch(joinUrl(apiBaseUrl, `runtime/forms/${formId}/uploads/${uploadId}/complete`), {
        method: 'POST',
        headers: { 'X-Upload-Session': uploadSession },
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json() as Promise<UploadReference>;
    },
  };
}
