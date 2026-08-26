'use client';

import type { FormDefinition } from '@tramites/form-contracts';
import { addContainer, addFaqBlock, addField, moveContainer, removeContainer, updateContainer } from '../model/definition';
import type { ConditionGroup, FormDefinition } from '@tramites/form-contracts';
import { containerFields } from '@tramites/form-contracts/field-rules';
import { addContainer, addExternalVariable, addField, addTextBlock, moveContainer, moveContainerItem, removeContainer, removeExternalVariable, removeTextBlock, setContainerCondition, setFormCondition, updateContainer, updateExternalVariable, updateTextBlock } from '../model/definition';
import type { DefinitionEditorErrors } from '../model/editor-validation';
import { FaqBlockEditor } from './faq-block-editor';
import { FieldEditor } from './field-editor';
import { ConditionEditor } from './condition-editor';

type DefinitionEditorProps = {
  definition: FormDefinition;
  editorErrors: DefinitionEditorErrors;
  setDefinition: (definition: FormDefinition) => void;
};

export function DefinitionEditor({ definition, editorErrors, setDefinition }: DefinitionEditorProps) {
  const conditionFields = definition.containers.filter((container) => container.kind !== 'repeater').flatMap((container) => containerFields(container));
  const toggleElementCondition = (condition: ConditionGroup | undefined, enabled: boolean, candidates = conditionFields): ConditionGroup | undefined => {
    if (!enabled) return undefined;
    const fieldId = candidates[0]?.id;
    const variable = definition.externalVariables?.[0]?.name;
    if (fieldId) return condition ?? { logic: 'all', rules: [{ source: { kind: 'field', fieldId }, operator: 'equals', value: '' }] };
    if (variable) return condition ?? { logic: 'all', rules: [{ source: { kind: 'external', variable }, operator: 'equals', value: '' }] };
    return condition;
  };
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
        </div>
      </div>

      <div className="form-grid" style={{ marginBottom: 18, padding: 14, border: '1px solid var(--line)', borderRadius: 10 }}>
        <div className="form-group full">
          <label>Condiciones del formulario</label>
          <div className="checkbox-row">
            {(['visible', 'enabled', 'included'] as const).map((key) => (
              <label key={key}><input type="checkbox" checked={Boolean(definition.conditions?.[key])} onChange={(event) => setDefinition(setFormCondition(definition, key, toggleElementCondition(definition.conditions?.[key], event.target.checked, [])))} />{key === 'visible' ? 'Visibilidad' : key === 'enabled' ? 'Habilitación' : 'Inclusión'}</label>
            ))}
          </div>
          {(['visible', 'enabled', 'included'] as const).map((key) => definition.conditions?.[key] && (
            <ConditionEditor key={key} label={key === 'visible' ? 'Visibilidad del formulario' : key === 'enabled' ? 'Habilitación del formulario' : 'Inclusión del formulario'} condition={definition.conditions[key]} otherFields={[]} externalVariables={definition.externalVariables} onChange={(value) => setDefinition(setFormCondition(definition, key, value))} />
          ))}
          {editorErrors.conditions && <span className="field-error">{editorErrors.conditions}</span>}
        </div>
        <div className="external-variable-catalog">
          <label>Variables externas del host</label>
          <span className="hint">Las variables trusted requieren contexto firmado para reglas de datos; título y contenido de bloques pueden resolver cualquier variable que el host envíe.</span>
          <div className="external-variable-list">
            {(definition.externalVariables ?? []).map((variable) => (
              <div className="form-group external-variable-row" key={variable.name}>
                <div className="external-variable-label">
                  <label>{variable.label} <code>{variable.name}</code></label>
                  <input value={variable.label} onChange={(event) => setDefinition(updateExternalVariable(definition, variable.name, { label: event.target.value }))} />
                </div>
                <div className="external-variable-control">
                  <label>Tipo</label>
                  <select value={variable.type} onChange={(event) => setDefinition(updateExternalVariable(definition, variable.name, { type: event.target.value as 'string' | 'number' | 'boolean' }))}>
                    <option value="string">Texto</option><option value="number">Número</option><option value="boolean">Booleano</option>
                  </select>
                </div>
                <div className="external-variable-control">
                  <label>Confianza</label>
                  <select value={variable.trust} onChange={(event) => setDefinition(updateExternalVariable(definition, variable.name, { trust: event.target.value as 'trusted' | 'presentation' }))}>
                    <option value="presentation">Presentación</option><option value="trusted">Trusted (firmada)</option>
                  </select>
                </div>
                <button type="button" className="button sm danger external-variable-remove" onClick={() => setDefinition(removeExternalVariable(definition, variable.name))}>Quitar</button>
              </div>
            ))}
          </div>
          <button type="button" className="button sm secondary external-variable-add" onClick={() => setDefinition(addExternalVariable(definition))}>+ Agregar variable externa</button>
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
            <div className="form-group full">
              <label>Condiciones de la sección</label>
              <div className="checkbox-row">
                {(['visible', 'enabled', 'included'] as const).map((key) => (
                  <label key={key}><input type="checkbox" checked={Boolean(container.conditions?.[key])} onChange={(event) => setDefinition(updateContainer(definition, container.id, (current) => setContainerCondition(current, key, toggleElementCondition(current.conditions?.[key], event.target.checked, conditionFields.filter((candidate) => !containerFields(container).some((field) => field.id === candidate.id))))))} />{key === 'visible' ? 'Visibilidad' : key === 'enabled' ? 'Habilitación' : 'Inclusión'}</label>
                ))}
              </div>
              {(['visible', 'enabled', 'included'] as const).map((key) => container.conditions?.[key] && (
                <ConditionEditor key={key} label={key === 'visible' ? 'Visibilidad de la sección' : key === 'enabled' ? 'Habilitación de la sección' : 'Inclusión de la sección'} condition={container.conditions[key]} otherFields={conditionFields.filter((candidate) => !containerFields(container).some((field) => field.id === candidate.id))} externalVariables={definition.externalVariables} onChange={(value) => setDefinition(updateContainer(definition, container.id, (current) => setContainerCondition(current, key, value)))} />
              ))}
              {editorErrors.containers[container.id]?.conditions && <span className="field-error">{editorErrors.containers[container.id]?.conditions}</span>}
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
                    step={1}
                    value={container.minRows ?? 0}
                    className={editorErrors.containers[container.id]?.rows ? 'invalid' : undefined}
                    onChange={(event) => setDefinition(updateContainer(definition, container.id, (current) => ({ ...current, minRows: Number(event.target.value) })))}
                  />
                </div>
                <div className="form-group">
                  <label>Máximo de filas</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    step={1}
                    value={container.maxRows ?? 10}
                    className={editorErrors.containers[container.id]?.rows ? 'invalid' : undefined}
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
                  setDefinition(updateContainer(definition, container.id, (current) => ({ ...current, columns: Number(event.target.value) as 1 | 2 | 3 | 4 })))
                }
              >
                <option value={1}>1 columna (Vista completa)</option>
                <option value={2}>2 columnas</option>
                <option value={3}>3 columnas</option>
                <option value={4}>4 columnas</option>
              </select>
            </div>
          </div>

          {editorErrors.containers[container.id]?.fields && (
            <span className="field-error">{editorErrors.containers[container.id]?.fields}</span>
          )}

          <div style={{ marginTop: 14 }}>
            {(container.items ?? container.fields.map((field) => ({ kind: 'field' as const, field }))).map((item, itemIndex) => item.kind === 'field' ? (
              <FieldEditor
                key={item.field.id}
                field={item.field}
                index={itemIndex}
                definition={definition}
                containerId={container.id}
                canMoveUp={itemIndex > 0}
                canMoveDown={itemIndex < (container.items ?? container.fields.map((field) => ({ kind: 'field' as const, field }))).length - 1}
                repeater={container.kind === 'repeater'}
                fieldErrors={editorErrors.fields[item.field.id]}
                setDefinition={setDefinition}
              />
            ) : (
              <div className={`field-editor${editorErrors.textBlocks[item.id] ? ' has-error' : ''}`} key={item.id}>
                <div className="field-head">
                  <span className="field-badge-type"><span style={{ color: 'var(--ink-muted)', fontSize: 11, fontWeight: 800 }}>#{itemIndex + 1}</span>Bloque informativo</span>
                  <div className="toolbar-actions">
                    <button type="button" className="button sm ghost" onClick={() => setDefinition(moveContainerItem(definition, item.id, -1))} disabled={itemIndex === 0} title="Mover arriba">↑</button>
                    <button type="button" className="button sm ghost" onClick={() => setDefinition(moveContainerItem(definition, item.id, 1))} disabled={itemIndex === (container.items ?? container.fields.map((field) => ({ kind: 'field' as const, field }))).length - 1} title="Mover abajo">↓</button>
                    <button type="button" className="button sm danger" onClick={() => setDefinition(removeTextBlock(definition, item.id))}>Eliminar</button>
                  </div>
                </div>
                <div className="form-grid">
                  <div className="form-group"><label>Título</label><input value={item.title ?? ''} className={editorErrors.textBlocks[item.id]?.title ? 'invalid' : undefined} aria-invalid={Boolean(editorErrors.textBlocks[item.id]?.title)} onChange={(event) => setDefinition(updateTextBlock(definition, item.id, (current) => ({ ...current, title: event.target.value })))} />{editorErrors.textBlocks[item.id]?.title && <span className="field-error">{editorErrors.textBlocks[item.id]?.title}</span>}</div>
                  <div className="form-group full"><label>Contenido</label><textarea value={item.text} className={editorErrors.textBlocks[item.id]?.text ? 'invalid' : undefined} aria-invalid={Boolean(editorErrors.textBlocks[item.id]?.text)} onChange={(event) => setDefinition(updateTextBlock(definition, item.id, (current) => ({ ...current, text: event.target.value })))} />{editorErrors.textBlocks[item.id]?.text && <span className="field-error">{editorErrors.textBlocks[item.id]?.text}</span>}<span className="hint">Podés usar variables externas con la forma <code>{'{{customerName}}'}</code>.</span></div>
                  <div className="form-group full"><label className="checkbox-row"><input type="checkbox" checked={Boolean(item.conditions?.visible)} onChange={(event) => setDefinition(updateTextBlock(definition, item.id, (current) => ({ ...current, conditions: event.target.checked ? { visible: current.conditions?.visible ?? toggleElementCondition(undefined, true)! } : undefined })))} /> Visibilidad condicional</label></div>
                </div>
                {item.conditions?.visible && <ConditionEditor label="Visibilidad del bloque" condition={item.conditions.visible} otherFields={conditionFields} externalVariables={definition.externalVariables} onChange={(value) => setDefinition(updateTextBlock(definition, item.id, (current) => ({ ...current, conditions: { visible: value } })))} />}
              </div>
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
          {container.kind !== 'repeater' && (
            <button type="button" className="button ghost" style={{ marginTop: 8, width: '100%' }} onClick={() => setDefinition(addTextBlock(definition, container.id))}>+ Agregar bloque informativo</button>
          )}
        </div>
      ))}

      {definition.containers.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📦</div>
          <h3>Este formulario no tiene contenedores aún</h3>
          <p className="hint">Agregá un contenedor para comenzar a añadir campos y dar formato a tu trámite.</p>
          {editorErrors.structure && <span className="field-error">{editorErrors.structure}</span>}
          <button
            className="button primary"
            onClick={() => setDefinition(addContainer(definition))}
            style={{ marginTop: 8 }}
          >
            + Agregar primer contenedor
          </button>
        </div>
      )}

      <div className="toolbar" style={{ marginTop: 28, paddingTop: 20, borderTop: '1px dashed var(--line)' }}>
        <div>
          <h2>Preguntas Frecuentes (FAQ)</h2>
          <span className="hint">
            Bloques informativos mostrados como acordeones en el formulario. No participan de la validación de campos ni del envío.
          </span>
        </div>
        <div className="toolbar-actions">
          <button
            type="button"
            className="button secondary"
            onClick={() => setDefinition(addFaqBlock(definition))}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Agregar Bloque FAQ
          </button>
        </div>
      </div>

      <div className="faq-blocks-list">
        {(definition.faqBlocks ?? []).map((block, blockIndex) => (
          <FaqBlockEditor
            key={block.id}
            block={block}
            index={blockIndex}
            count={definition.faqBlocks?.length ?? 0}
            definition={definition}
            blockErrors={editorErrors.faqBlocks[block.id]}
            setDefinition={setDefinition}
          />
        ))}
      </div>

      {(definition.faqBlocks ?? []).length === 0 && (
        <p className="hint" style={{ marginTop: 8 }}>Todavía no agregaste bloques FAQ.</p>
      )}
    </div>
  );
}
