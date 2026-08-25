import { Inject, Injectable } from '@nestjs/common';
import { flattenFields, formDefinitionSchema, FormDefinition, Json, RuntimeFormResponse, validateDefinition } from '@tramites/form-contracts';
import { assertFormAvailable } from './form-availability';
import { badRequest, conflict, notFound } from './http-error';
import { SupabaseService } from './supabase.service';
import { TipificationRegistry } from './tipification.registry';

type FormRow = { id: number; public_id: string; name: string; draft_definition: unknown; published_version_id: number | null; paused_at: string | null; created_at: string; updated_at: string };
type VersionRow = { id: number; form_id: number; version_number: number; definition: unknown; created_at: string };

@Injectable()
export class FormsService {
  constructor(
    @Inject(SupabaseService) private readonly supabase: SupabaseService,
    @Inject(TipificationRegistry) private readonly tipifications: TipificationRegistry,
  ) {}

  async list() {
    const { data, error } = await this.supabase.db.from('forms').select('*').order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((form) => this.toSummary(form));
  }

  async create(input: { name: string; definition: unknown }) {
    const definition = this.parseDefinition(input.definition);
    const { data, error } = await this.supabase.db.from('forms').insert({ name: input.name, draft_definition: definition as unknown as Json }).select('*').single();
    if (error || !data) throw new Error(error?.message ?? 'No se pudo crear el formulario');
    return this.toSummary(data);
  }

  async getDraft(publicId: string) {
    const form = await this.findForm(publicId);
    return { formId: form.public_id, name: form.name, definition: this.parseDefinition(form.draft_definition), updatedAt: form.updated_at };
  }

  async updateDraft(publicId: string, input: { name?: string; definition: unknown }) {
    const definition = this.parseDefinition(input.definition);
    await this.findForm(publicId);
    const { data, error } = await this.supabase.db.from('forms').update({ name: input.name?.trim() || undefined, draft_definition: definition as unknown as Json, updated_at: new Date().toISOString() }).eq('public_id', publicId).select('*').single();
    if (error || !data) throw new Error(error?.message ?? 'No se pudo guardar el borrador');
    return this.toSummary(data);
  }

  async publish(publicId: string) {
    const form = await this.findForm(publicId);
    const definition = this.parseDefinition(form.draft_definition);
    if (flattenFields(definition).some((field) => field.type === 'fileUpload') && (
      process.env.FORM_UPLOADS_ENABLED !== 'true'
      || process.env.FORM_UPLOADS_AUTHENTICATED !== 'true'
      || process.env.FORM_UPLOADS_MALWARE_SCANNED !== 'true'
    )) {
      badRequest('Los adjuntos requieren carga habilitada, autenticación BFF y análisis antimalware');
    }
    if (flattenFields(definition).some((field) => field.type === 'fileUpload') && !this.tipifications.supportsAttachments(definition)) {
      badRequest('El mapper de tipificación no admite referencias de archivos');
    }
    try {
      this.tipifications.assertAvailable(definition);
    } catch (error) {
      badRequest(error instanceof Error ? error.message : 'La tipificación del formulario no está configurada');
    }
    const { data: last, error: lastError } = await this.supabase.db.from('form_versions').select('version_number').eq('form_id', form.id).order('version_number', { ascending: false }).limit(1).maybeSingle();
    if (lastError) throw new Error(lastError.message);
    const versionNumber = (last?.version_number ?? 0) + 1;
    const { data: version, error: versionError } = await this.supabase.db.from('form_versions').insert({ form_id: form.id, version_number: versionNumber, definition: definition as unknown as Json }).select('*').single();
    if (versionError || !version) {
      if (versionError?.code === '23505') conflict('La versión ya existe, intentá de nuevo');
      throw new Error(versionError?.message ?? 'No se pudo publicar');
    }
    const { error: updateError } = await this.supabase.db.from('forms').update({ published_version_id: version.id, updated_at: new Date().toISOString() }).eq('id', form.id);
    if (updateError) throw new Error(updateError.message);
    return { formId: form.public_id, version: versionNumber, definition };
  }

  async pause(publicId: string) {
    const form = await this.findForm(publicId);
    if (form.paused_at) return this.toSummary(form);
    // Pausar es sacar de circulación lo publicado. Permitirlo sobre un borrador
    // dejaba un estado que el CMS no sabía deshacer, porque la acción de
    // reactivar colgaba de que hubiera versión publicada.
    if (!form.published_version_id) conflict('Solo se puede pausar un formulario publicado');
    return this.setPaused(publicId, new Date().toISOString());
  }

  async resume(publicId: string) {
    const form = await this.findForm(publicId);
    if (!form.paused_at) return this.toSummary(form);
    return this.setPaused(publicId, null);
  }

  /**
   * Punto único de control de disponibilidad. Lo llama runtime() y, a través de él,
   * las submissions y los uploads: los tres caminos de runtime pasan por acá.
   */
  assertAvailable(form: FormRow): void {
    assertFormAvailable(form);
  }

  private async setPaused(publicId: string, pausedAt: string | null) {
    const { data, error } = await this.supabase.db.from('forms').update({ paused_at: pausedAt, updated_at: new Date().toISOString() }).eq('public_id', publicId).select('*').single();
    if (error || !data) throw new Error(error?.message ?? 'No se pudo cambiar la disponibilidad del formulario');
    return this.toSummary(data);
  }

  async versions(publicId: string) {
    const form = await this.findForm(publicId);
    const { data, error } = await this.supabase.db.from('form_versions').select('id, form_id, version_number, definition, created_at').eq('form_id', form.id).order('version_number', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((version) => ({ id: version.id, version: version.version_number, createdAt: version.created_at, definition: this.parseDefinition(version.definition) }));
  }

  async runtime(publicId: string, mode: 'published' | 'draft' = 'published'): Promise<RuntimeFormResponse> {
    const form = await this.findForm(publicId);
    // La preview del CMS pide 'draft' y tiene que seguir funcionando: se pausa un formulario justamente para poder arreglarlo.
    if (mode === 'draft') return { formId: form.public_id, version: null, definition: this.parseDefinition(form.draft_definition), source: 'draft' };
    this.assertAvailable(form);
    if (!form.published_version_id) notFound('El formulario todavía no tiene una versión publicada');
    const { data, error } = await this.supabase.db.from('form_versions').select('*').eq('id', form.published_version_id).single();
    if (error || !data) throw new Error(error?.message ?? 'No se encontró la versión publicada');
    return { formId: form.public_id, version: data.version_number, definition: this.parseDefinition(data.definition), source: 'published' };
  }

  async findForm(publicId: string): Promise<FormRow> {
    const { data, error } = await this.supabase.db.from('forms').select('*').eq('public_id', publicId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) notFound(`No existe el formulario ${publicId}`);
    return data;
  }

  private parseDefinition(value: unknown): FormDefinition {
    const result = formDefinitionSchema.safeParse(value);
    if (!result.success) badRequest('La definición del formulario no es válida', result.error.flatten());
    return result.data;
  }

  private toSummary(form: FormRow) {
    const definition = this.parseDefinition(form.draft_definition);
    return { id: form.public_id, name: form.name, title: definition.title, published: Boolean(form.published_version_id), paused: Boolean(form.paused_at), pausedAt: form.paused_at, updatedAt: form.updated_at };
  }
}
