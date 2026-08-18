'use client';

import type { FormDefinition } from '@tramites/form-contracts';
import { addContainer, addField, addRepeater, moveContainer, removeContainer, updateContainer } from '../model/definition';
import type { DefinitionEditorErrors } from '../model/editor-validation';
import { FieldEditor } from './field-editor';

type DefinitionEditorProps = {
  definition: FormDefinition;
  editorErrors: DefinitionEditorErrors;
  setDefinition: (definition: FormDefinition) => void;
};

export function DefinitionEditor({ definition, editorErrors, setDefinition }: DefinitionEditorProps) {
  return (
    <div className="card">
      <div className="toolbar">
        <div>
          <h2>Estructura del Formulario</h2>
          <span className="hint">
            Organizá tus campos en contenedores y secciones. Cada <code>fieldName</code> se convertirá en una clave del objeto final.
          </span>
        </div>
        <div className="toolbar-actions">
        <button
          className="button secondary"
          onClick={() => setDefinition(addContainer(definition))}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo Contenedor
        </button>
        <button className="button secondary" onClick={() => setDefinition(addRepeater(definition))}>
          + Nueva Grilla Repetible
        </button>
        </div>
      </div>

      {definition.containers.map((container, containerIndex) => (
        <div className="container-editor" key={container.id}>
          <div className="container-head">
            <div className="container-title">
              <span className="container-num">{containerIndex + 1}</span>
              <span>{container.title || `Contenedor ${containerIndex + 1}`}</span>
              <span className="badge badge-info">{container.fields.length} {container.fields.length === 1 ? 'campo' : 'campos'}</span>
            </div>

            <div className="toolbar-actions">
              <button
                type="button"
                className="button sm ghost"
                onClick={() => setDefinition(moveContainer(definition, container.id, -1))}
                disabled={containerIndex === 0}
                title="Mover arriba"
              >
                ↑
              </button>
              <button
                type="button"
                className="button sm ghost"
                onClick={() => setDefinition(moveContainer(definition, container.id, 1))}
                disabled={containerIndex === definition.containers.length - 1}
                title="Mover abajo"
              >
                ↓
              </button>
              <button
                type="button"
                className="button sm danger"
                onClick={() => setDefinition(removeContainer(definition, container.id))}
              >
                Eliminar Contenedor
              </button>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Título del contenedor / sección</label>
              <input
                value={container.title}
                className={editorErrors.containers[container.id]?.title ? 'invalid' : undefined}
                aria-invalid={Boolean(editorErrors.containers[container.id]?.title)}
                onChange={(event) => setDefinition(updateContainer(definition, container.id, (current) => ({ ...current, title: event.target.value })))}
                placeholder="Ej. Datos Personales"
              />
              {editorErrors.containers[container.id]?.title && (
                <span className="field-error">{editorErrors.containers[container.id]?.title}</span>
              )}
            </div>
            {container.kind === 'repeater' && (
              <>
                <div className="form-group">
                  <label>Clave de payload de la grilla</label>
                  <input
                    value={container.fieldName ?? ''}
                    className={editorErrors.containers[container.id]?.fieldName ? 'invalid' : undefined}
                    aria-invalid={Boolean(editorErrors.containers[container.id]?.fieldName)}
                    onChange={(event) => setDefinition(updateContainer(definition, container.id, (current) => ({ ...current, fieldName: event.target.value })))}
                    placeholder="Ej. previousClaims"
                  />
                  {editorErrors.containers[container.id]?.fieldName && <span className="field-error">{editorErrors.containers[container.id]?.fieldName}</span>}
                </div>
                <div className="form-group">
                  <label>Mínimo de filas</label>
                  <input
                    type="number"
                    min={0}
                    value={container.minRows ?? 0}
                    onChange={(event) => setDefinition(updateContainer(definition, container.id, (current) => ({ ...current, minRows: Number(event.target.value) })))}
                  />
                </div>
                <div className="form-group">
                  <label>Máximo de filas</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={container.maxRows ?? 10}
                    onChange={(event) => setDefinition(updateContainer(definition, container.id, (current) => ({ ...current, maxRows: Number(event.target.value) })))}
                  />
                  {editorErrors.containers[container.id]?.rows && <span className="field-error">{editorErrors.containers[container.id]?.rows}</span>}
                </div>
              </>
            )}
            <div className="form-group">
              <label>Distribución en columnas</label>
              <select
                value={container.columns}
                onChange={(event) =>
                  setDefinition(updateContainer(definition, container.id, (current) => ({ ...current, columns: Number(event.target.value) as 1 | 2 })))
                }
              >
                <option value={1}>1 columna (Vista completa)</option>
                <option value={2}>2 columnas (Vista dividida)</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            {container.fields.map((field, fieldIndex) => (
              <FieldEditor
                key={field.id}
                field={field}
                index={fieldIndex}
                definition={definition}
                repeater={container.kind === 'repeater'}
                fieldErrors={editorErrors.fields[field.id]}
                setDefinition={setDefinition}
              />
            ))}
          </div>

          <button
            type="button"
            className="button secondary"
            style={{ marginTop: 16, width: '100%' }}
            onClick={() => setDefinition(addField(definition, container.id))}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Agregar Campo a este Contenedor
          </button>
        </div>
      ))}

      {definition.containers.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📦</div>
          <h3>Este formulario no tiene contenedores aún</h3>
          <p className="hint">Agregá un contenedor para comenzar a añadir campos y dar formato a tu trámite.</p>
          <button
            className="button primary"
            onClick={() => setDefinition(addContainer(definition))}
            style={{ marginTop: 8 }}
          >
            + Agregar primer contenedor
          </button>
        </div>
      )}
    </div>
  );
}
