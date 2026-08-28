'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormDefinition } from '@tramites/form-contracts';
import { upgradeDefinitionToV3 } from '@tramites/form-contracts/migrations';
import { toErrorMessage } from '../../../shared/lib/http';
import { formsApi, type FormsApi, type FormSummary } from '../api/forms-api';
import { INITIAL_DEFINITION } from '../model/constants';
import { collectDefinitionEditorErrors } from '../model/editor-validation';

export type WorkspaceStatus = { text: string; error?: boolean };
export type WorkspaceView = 'structure' | 'preview' | 'json';

export function useCmsWorkspace(api: FormsApi = formsApi) {
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [definition, setDefinition] = useState<FormDefinition>(INITIAL_DEFINITION);
  const [status, setStatus] = useState<WorkspaceStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<WorkspaceView>('structure');
  const selected = useMemo(() => forms.find((form) => form.id === selectedId), [forms, selectedId]);
  const editorErrors = useMemo(() => collectDefinitionEditorErrors(definition, name), [definition, name]);

  /**
   * Cambios sin guardar por formulario. Cambiar de formulario en la lista no
   * pierde lo que se estaba editando: se guarda acá y se restaura si se
   * vuelve a seleccionar, hasta que se guarde el borrador (ahí se descarta,
   * porque ya coincide con el servidor) o se recargue la página.
   */
  const unsavedDraftsRef = useRef(new Map<string, { name: string; definition: FormDefinition }>());

  const loadForms = useCallback(async () => {
    setForms(await api.list());
  }, [api]);

  useEffect(() => {
    void loadForms().catch((error: unknown) => {
      setStatus({ text: toErrorMessage(error, 'Error de carga'), error: true });
    });
  }, [loadForms]);

  async function selectForm(formId: string) {
    if (selectedId) unsavedDraftsRef.current.set(selectedId, { name, definition });
    setSelectedId(formId);
    setView('structure');
    setStatus(null);

    const pending = unsavedDraftsRef.current.get(formId);
    if (pending) {
      setName(pending.name);
      setDefinition(pending.definition);
      return;
    }

    const draft = await api.getDraft(formId);
    setName(draft.name);
    setDefinition(upgradeDefinitionToV3(draft.definition));
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
      setView('structure');
      setStatus({ text: 'Revisá los campos marcados antes de guardar', error: true });
      return false;
    }
    setSaving(true);
    setStatus(null);
    try {
      await api.saveDraft(selectedId, name, definition);
      unsavedDraftsRef.current.delete(selectedId);
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
    // Un borrador incompleto se guarda pero no se publica: el aviso tiene que
    // decir qué falta, no fallar recién contra el BFF.
    if (!editorErrors.canPublish) {
      setView('structure');
      setStatus({ text: editorErrors.structure ?? 'Completá los contenedores marcados antes de publicar', error: true });
      return;
    }
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

  async function toggleAvailability() {
    if (!selectedId || !selected) return;
    const pausing = !selected.paused;
    setSaving(true);
    setStatus(null);
    try {
      await (pausing ? api.pause(selectedId) : api.resume(selectedId));
      await loadForms();
      setStatus({ text: pausing ? 'Formulario pausado' : 'Formulario reactivado' });
    } catch (error) {
      setStatus({ text: toErrorMessage(error, pausing ? 'No se pudo pausar' : 'No se pudo reactivar'), error: true });
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
    view,
    setView,
    selectForm,
    createForm,
    saveDraft,
    publish,
    toggleAvailability,
  };
}
