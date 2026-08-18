import type { RuntimeFormResponse, SubmissionReceipt } from '@tramites/form-contracts';
import { joinUrl } from '../../../shared/lib/http';

export type SubmitInput = {
  version: number;
  payload: Record<string, string | number | boolean>;
};

export interface RuntimeApi {
  loadForm(formId: string, mode: 'published' | 'draft'): Promise<RuntimeFormResponse>;
  submit(formId: string, input: SubmitInput): Promise<SubmissionReceipt>;
}

export function createRuntimeApi(apiBaseUrl: string): RuntimeApi {
  return {
    async loadForm(formId, mode) {
      const response = await fetch(joinUrl(apiBaseUrl, `runtime/forms/${formId}?mode=${mode}`));
      if (!response.ok) throw new Error(await response.text());
      return response.json() as Promise<RuntimeFormResponse>;
    },
    async submit(formId, input) {
      const response = await fetch(joinUrl(apiBaseUrl, `runtime/forms/${formId}/submissions`), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify(input),
      });
      const body = await response.json().catch(() => undefined);
      if (!response.ok) {
        throw Object.assign(new Error((body as { message?: string } | undefined)?.message ?? 'No se pudo enviar el formulario'), { details: body });
      }
      return body as SubmissionReceipt;
    },
  };
}
