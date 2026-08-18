'use client';

import type { FieldType, FormDefinition, FormField } from '@tramites/form-contracts';
import {
  changeFieldType,
  moveField,
  otherFields,
  parseDefaultValue,
  removeField,
  setFieldCondition,
  setFieldErrorMessage,
  setFieldRule,
  toggleFieldCondition,
  updateField,
  type ConditionKey,
} from '../model/definition';
import { FIELD_TYPES, OPTION_FIELD_TYPES } from '../model/constants';
import type { FieldEditorErrors } from '../model/editor-validation';
import { ConditionEditor } from './condition-editor';
import { OptionsEditor } from './options-editor';

type FieldEditorProps = {
  field: FormField;
  index: number;
  definition: FormDefinition;
  fieldErrors?: FieldEditorErrors;
  setDefinition: (definition: FormDefinition) => void;
};

const TYPE_LABELS: Record<string, string> = {
  text: 'Texto simple',
  number: 'Número',
  select: 'Desplegable (Select)',
  checkbox: 'Casilla (Checkbox)',
  textarea: 'Texto largo (Textarea)',
  date: 'Fecha',
  time: 'Hora',
  radio: 'Botones Opción (Radio)',
  combobox: 'Búsqueda (Combobox)',
};

export function FieldEditor({ field, index, definition, fieldErrors, setDefinition }: FieldEditorProps) {
  const change = (update: (current: FormField) => FormField) => setDefinition(updateField(definition, field.id, update));
  const candidates = otherFields(definition, field.id);
  const toggleCondition = (key: ConditionKey, enabled: boolean) =>
    change((current) => toggleFieldCondition(current, key, enabled, candidates[0]?.id ?? ''));

  return (
    <div className={`field-editor${fieldErrors ? ' has-error' : ''}`}>
      <div className="field-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="field-badge-type">
            <span style={{ color: 'var(--ink-muted)', fontSize: 11, fontWeight: 800 }}>#{index + 1}</span>
            {field.label || field.fieldName || 'Campo sin título'}
          </span>
          <span className="field-type-tag">{TYPE_LABELS[field.type] || field.type}</span>
          {field.rules.required && <span className="badge badge-warning">Obligatorio</span>}
          {(field.conditions?.visible || field.conditions?.enabled || field.conditions?.required) && (
            <span className="badge badge-info">Condicional</span>
          )}
        </div>

        <div className="toolbar-actions">
          <button
            type="button"
            className="button sm ghost"
            onClick={() => setDefinition(moveField(definition, field.id, -1))}
            title="Mover arriba"
          >
            ↑
          </button>
          <button
            type="button"
            className="button sm ghost"
            onClick={() => setDefinition(moveField(definition, field.id, 1))}
            title="Mover abajo"
          >
            ↓
          </button>
          <button
            type="button"
            className="button sm danger"
            onClick={() => setDefinition(removeField(definition, field.id))}
          >
            Eliminar
          </button>
        </div>
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label>Etiqueta visible (Label)</label>
          <input
            value={field.label}
            className={fieldErrors?.label ? 'invalid' : undefined}
            aria-invalid={Boolean(fieldErrors?.label)}
            onChange={(event) => change((current) => ({ ...current, label: event.target.value }))}
            placeholder="Ej. Número de Póliza"
          />
          {fieldErrors?.label && <span className="field-error">{fieldErrors.label}</span>}
        </div>

        <div className="form-group">
          <label>
            Nombre de clave de payload (fieldName)
            <span className="hint">JSON key</span>
          </label>
          <input
            value={field.fieldName}
            className={fieldErrors?.fieldName ? 'invalid' : undefined}
            aria-invalid={Boolean(fieldErrors?.fieldName)}
            onChange={(event) => change((current) => ({ ...current, fieldName: event.target.value }))}
            placeholder="Ej. policyNumber"
          />
          {fieldErrors?.fieldName ? (
            <span className="field-error">{fieldErrors.fieldName}</span>
          ) : (
            <span className="hint">Debe empezar con una letra o _ . Solo letras, números y _.</span>
          )}
        </div>

        <div className="form-group">
          <label>Tipo de campo</label>
          <select
            value={field.type}
            onChange={(event) => change((current) => changeFieldType(current, event.target.value as FieldType))}
          >
            {FIELD_TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type] || type}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Ancho en pantalla</label>
          <select
            value={field.width ?? 'full'}
            onChange={(event) => change((current) => ({ ...current, width: event.target.value as 'full' | 'half' }))}
          >
            <option value="full">Ancho completo (100%)</option>
            <option value="half">Media columna (50%)</option>
          </select>
        </div>

        <div className="form-group">
          <label>Valor inicial por defecto</label>
          <input
            value={field.defaultValue === undefined ? '' : String(field.defaultValue)}
            onChange={(event) => change((current) => ({ ...current, defaultValue: parseDefaultValue(current.type, event.target.value) }))}
            placeholder={field.type === 'checkbox' ? 'true / false' : 'Opcional'}
          />
        </div>

        <div className="form-group">
          <label>Texto borrador (Placeholder)</label>
          <input
            value={field.placeholder ?? ''}
            onChange={(event) => change((current) => ({ ...current, placeholder: event.target.value }))}
            placeholder="Ej. Ingrese su número..."
          />
        </div>

        <div className="form-group full">
          <label>Texto de ayuda (Help text)</label>
          <input
            value={field.helpText ?? ''}
            onChange={(event) => change((current) => ({ ...current, helpText: event.target.value }))}
            placeholder="Ej. Se encuentra en el frente de la credencial"
          />
        </div>

        {OPTION_FIELD_TYPES.includes(field.type) && (
          <div className="form-group full">
            <OptionsEditor
              options={field.options}
              onChange={(options) => change((current) => ({ ...current, options }))}
            />
            {fieldErrors?.options && <span className="field-error">{fieldErrors.options}</span>}
          </div>
        )}
      </div>

      {/* Reglas de validación */}
      <div className="form-grid" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed var(--line)' }}>
        {field.type === 'number' && (
          <>
            <div className="form-group">
              <label>Mínimo numérico</label>
              <input
                type="number"
                value={field.rules.min ?? ''}
                onChange={(event) => change((current) => setFieldRule(current, 'min', event.target.value === '' ? undefined : Number(event.target.value)))}
                placeholder="Sin límite"
              />
            </div>
            <div className="form-group">
              <label>Máximo numérico</label>
              <input
                type="number"
                value={field.rules.max ?? ''}
                onChange={(event) => change((current) => setFieldRule(current, 'max', event.target.value === '' ? undefined : Number(event.target.value)))}
                placeholder="Sin límite"
              />
            </div>
          </>
        )}

        {['text', 'textarea'].includes(field.type) && (
          <>
            <div className="form-group">
              <label>Mínimo de caracteres</label>
              <input
                type="number"
                min={0}
                value={field.rules.minLength ?? ''}
                onChange={(event) =>
                  change((current) => setFieldRule(current, 'minLength', event.target.value === '' ? undefined : Number(event.target.value)))
                }
                placeholder="Ej. 3"
              />
            </div>
            <div className="form-group">
              <label>Máximo de caracteres</label>
              <input
                type="number"
                min={0}
                value={field.rules.maxLength ?? ''}
                onChange={(event) =>
                  change((current) => setFieldRule(current, 'maxLength', event.target.value === '' ? undefined : Number(event.target.value)))
                }
                placeholder="Ej. 100"
              />
            </div>
          </>
        )}

        <div className="form-group">
          <label>Expresión regular (Regex)</label>
          <input
            value={field.rules.pattern ?? ''}
            onChange={(event) => change((current) => setFieldRule(current, 'pattern', event.target.value || undefined))}
            placeholder="Ej. ^[A-Z0-9]+$"
          />
        </div>

        <div className="form-group">
          <label>Mensaje de error personalizado (Obligatorio)</label>
          <input
            value={field.rules.errorMessages?.required ?? ''}
            onChange={(event) => change((current) => setFieldErrorMessage(current, 'required', event.target.value))}
            placeholder="Ej. Este campo es requerido"
          />
        </div>
        {['text', 'textarea'].includes(field.type) && (
          <>
            <div className="form-group">
              <label>Mensaje de error (mínimo de caracteres)</label>
              <input
                value={field.rules.errorMessages?.minLength ?? ''}
                onChange={(event) => change((current) => setFieldErrorMessage(current, 'minLength', event.target.value))}
                placeholder="Ej. Escribí al menos 3 caracteres"
              />
            </div>
            <div className="form-group">
              <label>Mensaje de error (máximo de caracteres)</label>
              <input
                value={field.rules.errorMessages?.maxLength ?? ''}
                onChange={(event) => change((current) => setFieldErrorMessage(current, 'maxLength', event.target.value))}
                placeholder="Ej. Superaste el máximo permitido"
              />
            </div>
          </>
        )}
        {field.type === 'number' && (
          <>
            <div className="form-group">
              <label>Mensaje de error (mínimo numérico)</label>
              <input
                value={field.rules.errorMessages?.min ?? ''}
                onChange={(event) => change((current) => setFieldErrorMessage(current, 'min', event.target.value))}
                placeholder="Ej. El valor es demasiado bajo"
              />
            </div>
            <div className="form-group">
              <label>Mensaje de error (máximo numérico)</label>
              <input
                value={field.rules.errorMessages?.max ?? ''}
                onChange={(event) => change((current) => setFieldErrorMessage(current, 'max', event.target.value))}
                placeholder="Ej. El valor es demasiado alto"
              />
            </div>
          </>
        )}
      </div>

      {/* Switches & Condicionales */}
      <div className="checkbox-row">
        <label>
          <input
            type="checkbox"
            checked={Boolean(field.rules.required)}
            onChange={(event) => change((current) => setFieldRule(current, 'required', event.target.checked))}
          />
          Obligatorio
        </label>
        <label>
          <input
            type="checkbox"
            checked={Boolean(field.conditions?.visible)}
            onChange={(event) => toggleCondition('visible', event.target.checked)}
          />
          Visibilidad condicional
        </label>
        <label>
          <input
            type="checkbox"
            checked={Boolean(field.conditions?.enabled)}
            onChange={(event) => toggleCondition('enabled', event.target.checked)}
          />
          Habilitación condicional
        </label>
        <label>
          <input
            type="checkbox"
            checked={Boolean(field.conditions?.required)}
            onChange={(event) => toggleCondition('required', event.target.checked)}
          />
          Obligatoriedad condicional
        </label>
      </div>

      {candidates.length > 0 && (
        <>
          <ConditionEditor
            label="Visibilidad"
            condition={field.conditions?.visible}
            otherFields={candidates}
            onChange={(value) => change((current) => setFieldCondition(current, 'visible', value))}
          />
          <ConditionEditor
            label="Habilitación"
            condition={field.conditions?.enabled}
            otherFields={candidates}
            onChange={(value) => change((current) => setFieldCondition(current, 'enabled', value))}
          />
          <ConditionEditor
            label="Obligatoriedad"
            condition={field.conditions?.required}
            otherFields={candidates}
            onChange={(value) => change((current) => setFieldCondition(current, 'required', value))}
          />
        </>
      )}
    </div>
  );
}
