import { Inject, Injectable } from '@nestjs/common';
import { cleanSubmissionPayload, FormDefinition, Json, SubmissionReceipt } from '@tramites/form-contracts';
import { validateSubmission } from '@tramites/form-contracts/validation';
import { badRequest, conflict, notFound } from './http-error';
import { FormsService } from './forms.service';
import { SupabaseService } from './supabase.service';
import { DeliveryResult, DynamicsClient } from './dynamics.client';

type SubmissionRow = {
  id: number;
  public_id: string;
  form_id: number;
  form_version_id: number | null;
  idempotency_key: string;
  payload: unknown;
  delivery_status: 'pending' | 'delivered' | 'failed';
  delivery_attempts: number;
  last_delivery_error: string | null;
  external_response: unknown;
  submitted_at: string;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class SubmissionsService {
  constructor(
    @Inject(SupabaseService) private readonly supabase: SupabaseService,
    @Inject(FormsService) private readonly forms: FormsService,
    @Inject(DynamicsClient) private readonly dynamics: DynamicsClient,
  ) {}

  async submit(publicId: string, version: number, payload: Record<string, unknown>, idempotencyKey: string): Promise<SubmissionReceipt> {
    if (!idempotencyKey.trim()) badRequest('Idempotency-Key es obligatorio');
    const form = await this.forms.findForm(publicId);
    const runtime = await this.forms.runtime(publicId, 'published');
    if (runtime.version !== version) conflict('La versión del formulario ya no está publicada');
    const definition = runtime.definition;
    const result = validateSubmission(definition, payload);
    if (!result.success) badRequest('El payload no cumple la definición publicada', result.errors);
    const cleanPayload = cleanSubmissionPayload(definition, result.data);

    const { data: inserted, error } = await this.supabase.db.from('submissions').insert({
      form_id: form.id,
      form_version_id: runtime.version ? await this.versionId(form.id, runtime.version) : null,
      idempotency_key: idempotencyKey,
      payload: cleanPayload,
    }).select('*').single();

    if (error || !inserted) {
      if (error?.code === '23505') {
        const existing = await this.findByIdempotency(form.id, idempotencyKey);
        if (existing) return this.toReceipt(existing, publicId, runtime.version ?? 1);
      }
      throw new Error(error?.message ?? 'No se pudo guardar la submission');
    }

    const delivery = await this.deliver(inserted, publicId, runtime.version ?? 1);
    const updated = await this.updateDelivery(inserted.public_id, delivery);
    return this.toReceipt(updated, publicId, runtime.version ?? 1);
  }

  async retry(publicId: string): Promise<SubmissionReceipt> {
    const submission = await this.findByPublicId(publicId);
    const { data: form, error: formError } = await this.supabase.db.from('forms').select('public_id').eq('id', submission.form_id).single();
    if (formError || !form) notFound('No se encontró el formulario de la submission');
    if (!submission.form_version_id) badRequest('La submission no tiene versión asociada');
    const { data: version, error: versionError } = await this.supabase.db.from('form_versions').select('version_number, definition').eq('id', submission.form_version_id).single();
    if (versionError || !version) notFound('No se encontró la versión de la submission');
    const definition = version.definition as FormDefinition;
    const delivery = await this.deliver(submission, form.public_id, version.version_number);
    const updated = await this.updateDelivery(submission.public_id, delivery);
    return this.toReceipt(updated, form.public_id, version.version_number);
  }

  private async deliver(submission: SubmissionRow, formId: string, version: number): Promise<DeliveryResult> {
    const payload = submission.payload as Record<string, string | number | boolean>;
    return this.dynamics.deliver({
      submissionId: submission.public_id,
      formId,
      formVersion: version,
      submittedAt: new Date(submission.submitted_at).toISOString(),
      data: payload,
    });
  }

  private async updateDelivery(publicId: string, delivery: DeliveryResult): Promise<SubmissionRow> {
    const { data, error } = await this.supabase.db.from('submissions').update({
      delivery_status: delivery.status,
      delivery_attempts: undefined,
      last_delivery_error: delivery.error ?? null,
      external_response: (delivery.response ?? null) as Json,
      updated_at: new Date().toISOString(),
    }).eq('public_id', publicId).select('*').single();
    if (error || !data) throw new Error(error?.message ?? 'No se pudo actualizar el estado de entrega');
    const current = data as SubmissionRow;
    const nextAttempts = current.delivery_attempts + 1;
    const { data: withAttempts, error: attemptError } = await this.supabase.db.from('submissions').update({ delivery_attempts: nextAttempts }).eq('public_id', publicId).select('*').single();
    if (attemptError || !withAttempts) throw new Error(attemptError?.message ?? 'No se pudo guardar el intento de entrega');
    return withAttempts as SubmissionRow;
  }

  private async versionId(formId: number, version: number): Promise<number> {
    const { data, error } = await this.supabase.db.from('form_versions').select('id').eq('form_id', formId).eq('version_number', version).single();
    if (error || !data) throw new Error(error?.message ?? 'No se encontró la versión');
    return data.id;
  }

  private async findByIdempotency(formId: number, key: string): Promise<SubmissionRow | null> {
    const { data, error } = await this.supabase.db.from('submissions').select('*').eq('form_id', formId).eq('idempotency_key', key).maybeSingle();
    if (error) throw new Error(error.message);
    return data as SubmissionRow | null;
  }

  private async findByPublicId(publicId: string): Promise<SubmissionRow> {
    const { data, error } = await this.supabase.db.from('submissions').select('*').eq('public_id', publicId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) notFound('No existe la submission');
    return data as SubmissionRow;
  }

  private toReceipt(row: SubmissionRow, formId: string, version: number): SubmissionReceipt {
    return { submissionId: row.public_id, formId, formVersion: version, deliveryStatus: row.delivery_status, submittedAt: new Date(row.submitted_at).toISOString() };
  }
}
