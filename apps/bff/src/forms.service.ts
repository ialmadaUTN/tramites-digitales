import { Inject, Injectable } from '@nestjs/common';
import { formDefinitionSchema, FormDefinition, RuntimeFormResponse, validateDefinition } from '@tramites/form-contracts';
import { badRequest, conflict, notFound } from './http-error';
import { SupabaseService } from './supabase.service';

type FormRow = { id: number; public_id: string; name: string; draft_definition: unknown; published_version_id: number | null; created_at: string; updated_at: string };
type VersionRow = { id: number; form_id: number; version_number: number; definition: unknown; created_at: string };

@Injectable()
export class FormsService {
  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  async list() {
    const { data, error } = await this.supabase.db.from('forms').select('*').order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((form) => this.toSummary(form));
  }

  async create(input: { name: string; definition: unknown }) {
    const definition = this.parseDefinition(input.definition);
    const { data, error } = await this.supabase.db.from('forms').insert({ name: input.name, draft_definition: definition }).select('*').single();
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
    const { data, error } = await this.supabase.db.from('forms').update({ name: input.name?.trim() || undefined, draft_definition: definition, updated_at: new Date().toISOString() }).eq('public_id', publicId).select('*').single();
    if (error || !data) throw new Error(error?.message ?? 'No se pudo guardar el borrador');
    return this.toSummary(data);
  }

  async publish(publicId: string) {
    const form = await this.findForm(publicId);
    const definition = this.parseDefinition(form.draft_definition);
    const { data: last, error: lastError } = await this.supabase.db.from('form_versions').select('version_number').eq('form_id', form.id).order('version_number', { ascending: false }).limit(1).maybeSingle();
    if (lastError) throw new Error(lastError.message);
    const versionNumber = (last?.version_number ?? 0) + 1;
    const { data: version, error: versionError } = await this.supabase.db.from('form_versions').insert({ form_id: form.id, version_number: versionNumber, definition }).select('*').single();
    if (versionError || !version) {
      if (versionError?.code === '23505') conflict('La versión ya existe, intentá de nuevo');
      throw new Error(versionError?.message ?? 'No se pudo publicar');
    }
    const { error: updateError } = await this.supabase.db.from('forms').update({ published_version_id: version.id, updated_at: new Date().toISOString() }).eq('id', form.id);
    if (updateError) throw new Error(updateError.message);
    return { formId: form.public_id, version: versionNumber, definition };
  }

  async versions(publicId: string) {
    const form = await this.findForm(publicId);
    const { data, error } = await this.supabase.db.from('form_versions').select('id, form_id, version_number, definition, created_at').eq('form_id', form.id).order('version_number', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((version) => ({ id: version.id, version: version.version_number, createdAt: version.created_at, definition: this.parseDefinition(version.definition) }));
  }

  async runtime(publicId: string, mode: 'published' | 'draft' = 'published'): Promise<RuntimeFormResponse> {
    const form = await this.findForm(publicId);
    if (mode === 'draft') return { formId: form.public_id, version: null, definition: this.parseDefinition(form.draft_definition), source: 'draft' };
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
    return { id: form.public_id, name: form.name, title: definition.title, published: Boolean(form.published_version_id), updatedAt: form.updated_at };
  }
}
