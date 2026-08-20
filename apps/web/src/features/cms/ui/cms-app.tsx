'use client';

import { bffUrl } from '../../../shared/config/public-env';
import { RemoteForm } from '../../host/ui/remote-form';
import { useCmsWorkspace } from '../hooks/use-cms-workspace';
import { CmsShell } from './cms-shell';
import { DefinitionEditor } from './definition-editor';
import { FormList } from './form-list';
import { WorkspaceHeader } from './workspace-header';

export function CmsApp() {
  const workspace = useCmsWorkspace();

  return (
    <CmsShell selectedId={workspace.selectedId}>
      <div className="layout">
        <FormList
          forms={workspace.forms}
          selectedId={workspace.selectedId}
          saving={workspace.saving}
          onCreate={() => void workspace.createForm()}
          onSelect={(formId) => void workspace.selectForm(formId)}
        />

        <section className="editor">
          {!workspace.selectedId ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">📄</div>
                <h2>Empezá seleccionando o creando un formulario</h2>
                <p className="hint" style={{ maxWidth: 480 }}>
                  Seleccioná un formulario de la barra lateral para editarlo o utilizá el botón <strong>"+ Nuevo formulario"</strong> para crear uno desde cero.
                </p>
                <button
                  className="button primary"
                  onClick={() => void workspace.createForm()}
                  disabled={workspace.saving}
                  style={{ marginTop: 16 }}
                >
                  + Crear primer formulario
                </button>
              </div>
            </div>
          ) : (
            <>
              <WorkspaceHeader
                title={workspace.selected?.name ?? workspace.name}
                formId={workspace.selectedId}
                name={workspace.name}
                definition={workspace.definition}
                editorErrors={workspace.editorErrors}
                status={workspace.status}
                saving={workspace.saving}
                preview={workspace.preview}
                published={workspace.selected?.published ?? false}
                paused={workspace.selected?.paused ?? false}
                onNameChange={workspace.setName}
                onDefinitionChange={workspace.setDefinition}
                onTogglePreview={() => workspace.setPreview(!workspace.preview)}
                onSave={() => void workspace.saveDraft()}
                onPublish={() => void workspace.publish()}
                onToggleAvailability={() => void workspace.toggleAvailability()}
              />

              {workspace.preview ? (
                <div className="card">
                  <div className="preview">
                    <div className="preview-head">
                      <h3>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        Vista Previa Interactiva del Draft
                      </h3>
                      <span className="badge badge-info">Modo Borrador</span>
                    </div>
                    <RemoteForm formId={workspace.selectedId} apiBaseUrl={bffUrl} mode="draft" />
                  </div>
                </div>
              ) : (
                <DefinitionEditor
                  definition={workspace.definition}
                  editorErrors={workspace.editorErrors}
                  setDefinition={workspace.setDefinition}
                />
              )}
            </>
          )}
        </section>
      </div>
    </CmsShell>
  );
}
