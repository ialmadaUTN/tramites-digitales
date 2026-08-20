'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormDefinition } from '@tramites/form-contracts';
import { toErrorMessage } from '../../../shared/lib/http';
import { formsApi, type FormsApi, type FormSummary } from '../api/forms-api';
import { INITIAL_DEFINITION } from '../model/constants';
import { collectDefinitionEditorErrors } from '../model/editor-validation';

function upgradeDefinitionToV2(definition: FormDefinition): FormDefinition {
  if (definition.schemaVersion === 2) return definition;
  return {
    ...definition,
    schemaVersion: 2,
    tipificationKey: definition.tipificationKey ?? 'generic@v1',
    containers: definition.containers.map((container) => ({
      ...container,
      kind: container.kind ?? 'section',
      fields: container.fields.map((field) => (
        field.type === 'combobox' && field.allowCustomValue === undefined
          ? { ...field, allowCustomValue: true }
          : field
      )),
    })),
  };
}

export type WorkspaceStatus = { text: string; error?: boolean };

export function useCmsWorkspace(api: FormsApi = formsApi) {
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [definition, setDefinition] = useState<FormDefinition>(INITIAL_DEFINITION);
  const [status, setStatus] = useState<WorkspaceStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const selected = useMemo(() => forms.find((form) => form.id === selectedId), [forms, selectedId]);
  const editorErrors = useMemo(() => collectDefinitionEditorErrors(definition, name), [definition, name]);

  const loadForms = useCallback(async () => {
    setForms(await api.list());
  }, [api]);

  useEffect(() => {
    void loadForms().catch((error: unknown) => {
      setStatus({ text: toErrorMessage(error, 'Error de carga'), error: true });
    });
  }, [loadForms]);

  async function selectForm(formId: string) {
    setSelectedId(formId);
    setPreview(false);
    setStatus(null);
    const draft = await api.getDraft(formId);
    setName(draft.name);
    setDefinition(upgradeDefinitionToV2(draft.definition));
  }

  async function createForm() {
    setSaving(true);
    setStatus(null);
    try {
      const created = await api.create('Nuevo formulario', INITIAL_DEFINITION);
      await loadForms();
      await selectForm(created.id);
      setStatus({ text: 'Formulario creado' });
    } catch (error) {
      setStatus({ text: toErrorMessage(error, 'No se pudo crear'), error: true });
    } finally {
      setSaving(false);
    }
  }

  async function saveDraft() {
    if (!selectedId) return false;
    if (editorErrors.hasErrors) {
      setPreview(false);
      setStatus({ text: 'Revisá los campos marcados antes de guardar', error: true });
      return false;
    }
    setSaving(true);
    setStatus(null);
    try {
      await api.saveDraft(selectedId, name, definition);
      await loadForms();
      setStatus({ text: 'Borrador guardado' });
      return true;
    } catch (error) {
      setStatus({ text: toErrorMessage(error, 'No se pudo guardar'), error: true });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!selectedId) return;
    const saved = await saveDraft();
    if (!saved) return;
    setSaving(true);
    try {
      await api.publish(selectedId);
      await loadForms();
      setStatus({ text: 'Versión publicada' });
    } catch (error) {
      setStatus({ text: toErrorMessage(error, 'No se pudo publicar'), error: true });
    } finally {
      setSaving(false);
    }
  }

  return {
    forms,
    selected,
    selectedId,
    name,
    setName,
    definition,
    setDefinition,
    editorErrors,
    status,
    saving,
    preview,
    setPreview,
    selectForm,
    createForm,
    saveDraft,
    publish,
  };
}
