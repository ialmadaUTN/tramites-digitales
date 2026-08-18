'use client';

import { useState } from 'react';
import type { FormDefinition } from '@tramites/form-contracts';
import type { WorkspaceStatus } from '../hooks/use-cms-workspace';
import type { DefinitionEditorErrors } from '../model/editor-validation';

type WorkspaceHeaderProps = {
  title: string;
  formId: string;
  name: string;
  definition: FormDefinition;
  editorErrors: DefinitionEditorErrors;
  status: WorkspaceStatus | null;
  saving: boolean;
  preview: boolean;
  onNameChange: (name: string) => void;
  onDefinitionChange: (definition: FormDefinition) => void;
  onTogglePreview: () => void;
  onSave: () => void;
  onPublish: () => void;
};

export function WorkspaceHeader({
  title,
  formId,
  name,
  definition,
  editorErrors,
  status,
  saving,
  preview,
  onNameChange,
  onDefinitionChange,
  onTogglePreview,
  onSave,
  onPublish,
}: WorkspaceHeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyId = () => {
    void navigator.clipboard.writeText(formId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card">
      <div className="toolbar">
        <div className="toolbar-info">
          <h2>{title}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span className="code-tag" style={{ cursor: 'pointer' }} onClick={handleCopyId} title="Click para copiar ID completo">
              {formId.slice(0, 8)}...
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 4 }}>
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </span>
            {copied && <span className="badge badge-success">¡Copiado!</span>}
          </div>
        </div>

        <div className="toolbar-actions">
          <div className="segmented-control">
            <button
              type="button"
              className={`segmented-btn ${!preview ? 'active' : ''}`}
              onClick={() => preview && onTogglePreview()}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              Estructura
            </button>
            <button
              type="button"
              className={`segmented-btn ${preview ? 'active' : ''}`}
              onClick={() => !preview && onTogglePreview()}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Vista Previa
            </button>
          </div>

          <button className="button secondary" onClick={onSave} disabled={saving}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            Guardar
          </button>

          <button className="button primary" onClick={onPublish} disabled={saving}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            {saving ? 'Publicando...' : 'Publicar'}
          </button>
        </div>
      </div>

      {status && (
        <div className={`status ${status.error ? 'error' : ''}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            {status.error ? (
              <>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </>
            ) : (
              <>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </>
            )}
          </svg>
          {status.text}
        </div>
      )}

      <div className="form-grid" style={{ marginTop: 20 }}>
        <div className="form-group">
          <label>Nombre interno (gestión)</label>
          <input
            value={name}
            className={editorErrors.name ? 'invalid' : undefined}
            aria-invalid={Boolean(editorErrors.name)}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Ej. Solicitud de Licencia"
          />
          {editorErrors.name && <span className="field-error">{editorErrors.name}</span>}
        </div>
        <div className="form-group">
          <label>Título visible al usuario</label>
          <input
            value={definition.title}
            className={editorErrors.title ? 'invalid' : undefined}
            aria-invalid={Boolean(editorErrors.title)}
            onChange={(event) => onDefinitionChange({ ...definition, title: event.target.value })}
            placeholder="Ej. Formulario de Solicitud"
          />
          {editorErrors.title && <span className="field-error">{editorErrors.title}</span>}
        </div>
        <div className="form-group full">
          <label>Descripción pública</label>
          <textarea
            value={definition.description ?? ''}
            onChange={(event) => onDefinitionChange({ ...definition, description: event.target.value })}
            placeholder="Ingresá una breve explicación para el solicitante..."
          />
        </div>
        <div className="form-group">
          <label>Etiqueta del botón de envío</label>
          <input
            value={definition.submitLabel}
            className={editorErrors.submitLabel ? 'invalid' : undefined}
            aria-invalid={Boolean(editorErrors.submitLabel)}
            onChange={(event) => onDefinitionChange({ ...definition, submitLabel: event.target.value })}
            placeholder="Enviar solicitud"
          />
          {editorErrors.submitLabel && <span className="field-error">{editorErrors.submitLabel}</span>}
        </div>
        <div className="form-group">
          <label>Clave de tipificación</label>
          <input
            value={definition.tipificationKey ?? ''}
            onChange={(event) => onDefinitionChange({ ...definition, schemaVersion: 2, tipificationKey: event.target.value })}
            placeholder="Ej. generic"
          />
          <span className="hint">Debe coincidir con un mapper registrado en el BFF.</span>
        </div>
      </div>
    </div>
  );
}
