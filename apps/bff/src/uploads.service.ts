import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { flattenFields, FormDefinition, FormField, UploadReference } from '@tramites/form-contracts';
import { badRequest, notFound } from './http-error';
import { FormsService } from './forms.service';
import { SupabaseService } from './supabase.service';

const BUCKET = 'tramites-attachments';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;

type UploadRow = {
  id: string;
  form_id: number;
  form_version_id: number | null;
  field_name: string;
  object_path: string;
  original_name: string;
  content_type: (typeof ALLOWED_MIME_TYPES)[number];
  size_bytes: number;
  owner_key_hash: string;
  status: 'pending' | 'ready' | 'attached' | 'expired' | 'rejected';
  expires_at: string;
};

export type UploadTicket = {
  uploadId: string;
  bucket: string;
  path: string;
  token: string;
  expiresIn: number;
};

@Injectable()
export class UploadsService implements OnModuleInit {
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    @Inject(SupabaseService) private readonly supabase: SupabaseService,
    @Inject(FormsService) private readonly forms: FormsService,
  ) {}

  async onModuleInit() {
    if (!this.enabled()) return;
    await this.ensureBucket();
    await this.cleanupExpired();
    this.cleanupTimer = setInterval(() => void this.cleanupExpired(), 24 * 60 * 60 * 1000);
    this.cleanupTimer.unref();
  }

  async createUpload(
    formId: string,
    fieldName: string,
    input: { name: string; contentType: string; size: number },
    sessionKey: string,
  ): Promise<UploadTicket> {
    this.assertEnabled();
    const runtime = await this.forms.runtime(formId, 'published');
    const field = flattenFields(runtime.definition).find((candidate) => candidate.fieldName === fieldName);
    if (!field || field.type !== 'fileUpload') badRequest('El campo no admite archivos');
    this.assertFileMetadata(field, input);
    const ownerHash = this.ownerHash(sessionKey);
    const uploadId = randomUUID();
    const safeName = input.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'file';
    const objectPath = `${formId}/${ownerHash}/${uploadId}-${safeName}`;
    const form = await this.forms.findForm(formId);
    const versionId = runtime.version ? await this.versionId(form.id, runtime.version) : null;

    const { error: insertError } = await this.supabase.db.from('uploads').insert({
      id: uploadId,
      form_id: form.id,
      form_version_id: versionId,
      field_name: fieldName,
      object_path: objectPath,
      original_name: input.name,
      content_type: input.contentType as (typeof ALLOWED_MIME_TYPES)[number],
      size_bytes: input.size,
      owner_key_hash: ownerHash,
    });
    if (insertError) throw new Error(insertError.message);

    const { data, error } = await this.supabase.storage.from(BUCKET).createSignedUploadUrl(objectPath, { upsert: false });
    if (error || !data) {
      await this.supabase.db.from('uploads').delete().eq('id', uploadId);
      throw new Error(error?.message ?? 'No se pudo preparar la carga');
    }
    return { uploadId, bucket: BUCKET, path: data.path, token: data.token, expiresIn: 7200 };
  }

  async completeUpload(formId: string, uploadId: string, sessionKey: string): Promise<UploadReference> {
    this.assertEnabled();
    // También acá, no solo al abrir la carga: completarla sobre un formulario
    // pausado no puede desembocar en nada —la submission se rechaza igual— pero
    // escribe en storage y deja la carga en `ready`. "Pausado" tiene que
    // significar lo mismo en los cuatro caminos de runtime.
    await this.forms.runtime(formId, 'published');
    const upload = await this.findOwnedUpload(formId, uploadId, sessionKey);
    if (upload.status !== 'pending') badRequest('La carga no está pendiente');
    if (new Date(upload.expires_at).getTime() < Date.now()) badRequest('La carga expiró');
    const { data, error } = await this.supabase.storage.from(BUCKET).download(upload.object_path);
    if (error || !data) badRequest('No se pudo verificar el archivo cargado');
    if (data.size !== upload.size_bytes || data.type !== upload.content_type) {
      await this.rejectUpload(upload);
      badRequest('El archivo cargado no coincide con los metadatos declarados');
    }
    const { error: updateError } = await this.supabase.db.from('uploads').update({
      status: 'ready',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', upload.id);
    if (updateError) throw new Error(updateError.message);
    return this.toReference({ ...upload, status: 'ready' });
  }

  async assertSubmissionUploads(
    formId: string,
    definition: FormDefinition,
    payload: Record<string, unknown>,
    sessionKey: string,
    formVersionId: number,
  ): Promise<void> {
    const fileFields = flattenFields(definition).filter((field) => field.type === 'fileUpload');
    const references = fileFields.flatMap((field) => {
      const value = payload[field.fieldName];
      return Array.isArray(value)
        ? value
          .filter((item): item is UploadReference => Boolean(item && typeof item === 'object' && 'uploadId' in item))
          .map((reference) => ({ fieldName: field.fieldName, reference }))
        : [];
    });
    if (references.length === 0) return;
    this.assertEnabled();
    const ids = references.map(({ reference }) => reference.uploadId);
    if (new Set(ids).size !== ids.length) badRequest('Un archivo no puede repetirse en la misma submission');
    const { data, error } = await this.supabase.db.from('uploads').select('*').in('id', ids);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as UploadRow[];
    const ownerHash = this.ownerHash(sessionKey);
    const form = await this.forms.findForm(formId);
    for (const { fieldName, reference } of references) {
      const row = rows.find((candidate) => candidate.id === reference.uploadId);
      if (!row || row.owner_key_hash !== ownerHash || row.status !== 'ready' || row.form_id !== form.id || row.form_version_id !== formVersionId || row.field_name !== fieldName) {
        badRequest('Uno de los archivos no pertenece a la sesión actual');
      }
      if (row.original_name !== reference.name || row.content_type !== reference.contentType || row.size_bytes !== reference.size) {
        badRequest('La referencia del archivo no coincide con el archivo cargado');
      }
    }
  }

  async attachToSubmission(submissionId: number, payload: Record<string, unknown>): Promise<void> {
    const references = Object.values(payload).flatMap((value) => Array.isArray(value) ? value.filter((item): item is UploadReference => Boolean(item && typeof item === 'object' && 'uploadId' in item)) : []);
    for (const reference of references) {
      const { error: insertError } = await this.supabase.db.from('submission_uploads').insert({ submission_id: submissionId, upload_id: reference.uploadId });
      if (insertError) throw new Error(insertError.message);
      const { error: updateError } = await this.supabase.db.from('uploads').update({ status: 'attached', attached_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', reference.uploadId);
      if (updateError) throw new Error(updateError.message);
    }
  }

  async cleanupExpired(): Promise<void> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase.db.from('uploads').select('id, object_path').lt('expires_at', now).in('status', ['pending', 'ready', 'rejected']);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{ id: string; object_path: string }>;
    if (!rows.length) return;
    await this.supabase.storage.from(BUCKET).remove(rows.map((row) => row.object_path));
    const { error: deleteError } = await this.supabase.db.from('uploads').delete().in('id', rows.map((row) => row.id));
    if (deleteError) throw new Error(deleteError.message);
  }

  private enabled(): boolean {
    return process.env.FORM_UPLOADS_ENABLED === 'true'
      && process.env.FORM_UPLOADS_AUTHENTICATED === 'true'
      && process.env.FORM_UPLOADS_MALWARE_SCANNED === 'true';
  }

  private assertEnabled(): void {
    if (!this.enabled()) badRequest('La carga de archivos está deshabilitada en este ambiente');
  }

  private async ensureBucket(): Promise<void> {
    const { data } = await this.supabase.storage.getBucket(BUCKET);
    if (data) return;
    const { error } = await this.supabase.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: MAX_FILE_SIZE,
      allowedMimeTypes: [...ALLOWED_MIME_TYPES],
    });
    if (error && !/already exists/i.test(error.message)) throw new Error(error.message);
  }

  private assertFileMetadata(field: FormField, input: { name: string; contentType: string; size: number }): void {
    const allowed = field.allowedMimeTypes ?? [...ALLOWED_MIME_TYPES];
    if (!allowed.includes(input.contentType as never) || !ALLOWED_MIME_TYPES.includes(input.contentType as never)) badRequest('Tipo de archivo no permitido');
    if (!Number.isInteger(input.size) || input.size <= 0 || input.size > MAX_FILE_SIZE) badRequest('El archivo supera el tamaño máximo permitido');
    const maxFiles = field.maxFiles ?? 5;
    if (maxFiles > 5) badRequest('El campo supera el máximo global de archivos');
  }

  private async findOwnedUpload(formId: string, uploadId: string, sessionKey: string): Promise<UploadRow> {
    const form = await this.forms.findForm(formId);
    const { data, error } = await this.supabase.db.from('uploads').select('*').eq('id', uploadId).eq('form_id', form.id).eq('owner_key_hash', this.ownerHash(sessionKey)).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) notFound('No existe la carga');
    return data as UploadRow;
  }

  private async rejectUpload(upload: UploadRow): Promise<void> {
    await this.supabase.storage.from(BUCKET).remove([upload.object_path]);
    await this.supabase.db.from('uploads').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', upload.id);
  }

  private ownerHash(sessionKey: string): string {
    if (!sessionKey.trim()) badRequest('La sesión de carga es obligatoria');
    return createHash('sha256').update(sessionKey).digest('hex');
  }

  private async versionId(formId: number, version: number): Promise<number> {
    const { data, error } = await this.supabase.db.from('form_versions').select('id').eq('form_id', formId).eq('version_number', version).single();
    if (error || !data) throw new Error(error?.message ?? 'No se encontró la versión');
    return data.id;
  }

  private toReference(row: UploadRow): UploadReference {
    return { uploadId: row.id, name: row.original_name, contentType: row.content_type, size: row.size_bytes };
  }
}
