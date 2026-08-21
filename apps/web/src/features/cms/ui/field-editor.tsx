'use client';

import type { AllowedMimeType, FieldType, FormDefinition, FormField, MaskKind } from '@tramites/form-contracts';
import { isMaskCompatible } from '@tramites/form-contracts/field-rules';
import { REQUIRED_CONFLICT_MESSAGE } from '@tramites/form-contracts/required-semantics';
import {
  changeFieldType,
  moveField,
  otherFields,
  parseDefaultValue,
  removeField,
  setFieldCondition,
  setFieldDefaultValue,
  setFieldErrorMessage,
  setFieldReadOnly,
  setFieldRule,
  toggleDefaultOption,
  toggleFieldCondition,
  updateField,
  type ConditionKey,
} from '../model/definition';
import {
  FIELD_TYPES,
  FILE_TYPE_OPTIONS,
  LENGTH_RULE_FIELD_TYPES,
  MASK_FIELD_TYPES,
  MASK_OPTIONS,
  OPTION_FIELD_TYPES,
  READ_ONLY_BLOCKED_FIELD_TYPES,
  REPEATER_FIELD_TYPES,
} from '../model/constants';
import type { FieldEditorErrors } from '../model/editor-validation';
import { ConditionEditor } from './condition-editor';
import { OptionsEditor } from './options-editor';

type FieldEditorProps = {
  field: FormField;
  index: number;
  definition: FormDefinition;
  fieldErrors?: FieldEditorErrors;
  repeater?: boolean;
  setDefinition: (definition: FormDefinition) => void;
};

const TYPE_LABELS: Record<string, string> = {
  text: 'Texto simple',
  email: 'Email',
  phone: 'Teléfono',
  alphabetic: 'Solo letras',
  alphanumeric: 'Alfanumérico',
  number: 'Número',
  select: 'Desplegable (Select)',
  checkbox: 'Casilla (Checkbox)',
  textarea: 'Texto largo (Textarea)',
  date: 'Fecha',
  time: 'Hora',
  multiselect: 'Selección múltiple',
  fileUpload: 'Archivos (PDF / imagen)',
  radio: 'Botones Opción (Radio)',
  combobox: 'Búsqueda (Combobox)',
};

/** `true` cuando el valor por defecto debe elegirse del catálogo y no escribirse a mano. */
function picksFromCatalog(field: FormField): boolean {
  if (!OPTION_FIELD_TYPES.includes(field.type)) return false;
  return field.type !== 'combobox' || field.allowCustomValue === false;
}

function DefaultValueControl({ field, onChange }: { field: FormField; onChange: (next: FormField) => void }) {
  const options = field.options ?? [];

  if (field.type === 'multiselect') {
    const selected = Array.isArray(field.defaultValue) ? field.defaultValue : [];
    if (options.length === 0) return <span className="hint">Cargá opciones para elegir un valor por defecto.</span>;
    return (
      <div className="default-value-list">
        {options.map((option) => (
          <label className="default-value-option" key={String(option.value)}>
            <input
              type="checkbox"
              checked={selected.some((item) => String(item) === String(option.value))}
              onChange={(event) =>
                onChange(setFieldDefaultValue(field, toggleDefaultOption(field.defaultValue, option.value, event.target.checked)))
              }
            />
            {option.label}
          </label>
        ))}
      </div>
    );
  }

  if (picksFromCatalog(field)) {
    if (options.length === 0) return <span className="hint">Cargá opciones para elegir un valor por defecto.</span>;
    return (
      <select
        value={field.defaultValue === undefined ? '' : String(field.defaultValue)}
        onChange={(event) => {
          const selected = options.find((option) => String(option.value) === event.target.value);
          onChange(setFieldDefaultValue(field, selected ? selected.value : undefined));
        }}
      >
        <option value="">Sin valor inicial</option>
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <select
        value={field.defaultValue === undefined ? '' : String(field.defaultValue)}
        onChange={(event) =>
          onChange(setFieldDefaultValue(field, event.target.value === '' ? undefined : event.target.value === 'true'))
        }
      >
        <option value="">Sin valor inicial</option>
        <option value="true">Marcado (true)</option>
        <option value="false">Sin marcar (false)</option>
      </select>
    );
  }

  const inputType = field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'time' ? 'time' : 'text';
  return (
    <input
      type={inputType}
      value={field.defaultValue === undefined ? '' : String(field.defaultValue)}
      onChange={(event) => onChange(setFieldDefaultValue(field, parseDefaultValue(field.type, event.target.value)))}
      placeholder="Opcional"
    />
  );
}

export function FieldEditor({ field, index, definition, fieldErrors, repeater = false, setDefinition }: FieldEditorProps) {
  const change = (update: (current: FormField) => FormField) => setDefinition(updateField(definition, field.id, update));
  const candidates = otherFields(definition, field.id);
  const toggleCondition = (key: ConditionKey, enabled: boolean) =>
    change((current) => toggleFieldCondition(current, key, enabled, candidates[0]?.id ?? ''));

  const acceptsLengthRules = LENGTH_RULE_FIELD_TYPES.includes(field.type);
  const acceptsMask = MASK_FIELD_TYPES.includes(field.type);
  const acceptsReadOnly = !READ_ONLY_BLOCKED_FIELD_TYPES.includes(field.type);
  const fixedRequired = Boolean(field.rules.required);
  const conditionalRequired = Boolean(field.conditions?.required);

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
          {field.readOnly && <span className="badge badge-info">Solo lectura</span>}
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
            className={fieldErrors?.type ? 'invalid' : undefined}
            aria-invalid={Boolean(fieldErrors?.type)}
            onChange={(event) => change((current) => changeFieldType(current, event.target.value as FieldType))}
          >
            {(repeater ? REPEATER_FIELD_TYPES : FIELD_TYPES).map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type] || type}
              </option>
            ))}
          </select>
          {fieldErrors?.type && <span className="field-error">{fieldErrors.type}</span>}
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

        {field.type !== 'fileUpload' && (
          <div className="form-group">
            <label>Valor inicial por defecto</label>
            <DefaultValueControl field={field} onChange={(next) => change(() => next)} />
            {fieldErrors?.defaultValue && <span className="field-error">{fieldErrors.defaultValue}</span>}
          </div>
        )}

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
              error={fieldErrors?.options}
              onChange={(options) => change((current) => ({ ...current, options }))}
            />
            {fieldErrors?.options && <span className="field-error">{fieldErrors.options}</span>}
          </div>
        )}
        {acceptsMask && (
          <div className="form-group">
            <label>Máscara</label>
            <select
              value={field.maskKind ?? ''}
              className={fieldErrors?.mask ? 'invalid' : undefined}
              aria-invalid={Boolean(fieldErrors?.mask)}
              onChange={(event) =>
                change((current) => ({ ...current, maskKind: event.target.value ? (event.target.value as MaskKind) : undefined }))
              }
            >
              <option value="">Sin máscara</option>
              {MASK_OPTIONS.filter((mask) => isMaskCompatible(field.type, mask.value)).map((mask) => (
                <option key={mask.value} value={mask.value}>
                  {mask.label}
                </option>
              ))}
            </select>
            {fieldErrors?.mask && <span className="field-error">{fieldErrors.mask}</span>}
          </div>
        )}
        {field.type === 'combobox' && (
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={field.allowCustomValue !== false}
              onChange={(event) => change((current) => ({ ...current, allowCustomValue: event.target.checked }))}
            />
            Permitir valores fuera del listado
          </label>
        )}
        {field.type === 'fileUpload' && (
          <>
            <div className="form-group">
              <label>Mínimo de archivos</label>
              <input
                type="number"
                min={0}
                max={5}
                value={field.minFiles ?? 0}
                className={fieldErrors?.files ? 'invalid' : undefined}
                onChange={(event) => change((current) => ({ ...current, minFiles: Number(event.target.value) }))}
              />
            </div>
            <div className="form-group">
              <label>Máximo de archivos</label>
              <input
                type="number"
                min={1}
                max={5}
                value={field.maxFiles ?? 5}
                className={fieldErrors?.files ? 'invalid' : undefined}
                onChange={(event) => change((current) => ({ ...current, maxFiles: Number(event.target.value) }))}
                />
            </div>
            <div className="form-group full">
              <label>Tipos de archivo permitidos</label>
              <div className="checkbox-row">
                {FILE_TYPE_OPTIONS.map((fileType) => {
                  const allTypes = FILE_TYPE_OPTIONS.map((option) => option.value);
                  const selectedTypes = field.allowedMimeTypes ?? allTypes;
                  return (
                    <label key={fileType.value}>
                      <input
                        type="checkbox"
                        checked={selectedTypes.includes(fileType.value)}
                        onChange={(event) => change((current) => {
                          const currentTypes = current.allowedMimeTypes ?? allTypes;
                          if (!event.target.checked && currentTypes.length === 1) return current;
                          const nextTypes = event.target.checked
                            ? [...new Set([...currentTypes, fileType.value])] as AllowedMimeType[]
                            : currentTypes.filter((type) => type !== fileType.value);
                          return {
                            ...current,
                            allowedMimeTypes: nextTypes.length === allTypes.length ? undefined : nextTypes,
                          };
                        })}
                      />
                      {fileType.label}
                    </label>
                  );
                })}
              </div>
              <span className="hint">Debe quedar seleccionado al menos un tipo.</span>
            </div>
            <div className="form-group full">
              {fieldErrors?.files ? (
                <span className="field-error">{fieldErrors.files}</span>
              ) : (
                <span className="hint">Solo se admiten PDF, JPG y PNG de hasta 10 MB por archivo.</span>
              )}
            </div>
          </>
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
                className={fieldErrors?.range ? 'invalid' : undefined}
                onChange={(event) => change((current) => setFieldRule(current, 'min', event.target.value === '' ? undefined : Number(event.target.value)))}
                placeholder="Sin límite"
              />
            </div>
            <div className="form-group">
              <label>Máximo numérico</label>
              <input
                type="number"
                value={field.rules.max ?? ''}
                className={fieldErrors?.range ? 'invalid' : undefined}
                onChange={(event) => change((current) => setFieldRule(current, 'max', event.target.value === '' ? undefined : Number(event.target.value)))}
                placeholder="Sin límite"
              />
              {fieldErrors?.range && <span className="field-error">{fieldErrors.range}</span>}
            </div>
          </>
        )}

        {acceptsLengthRules && (
          <>
            <div className="form-group">
              <label>Mínimo de caracteres</label>
              <input
                type="number"
                min={0}
                step={1}
                value={field.rules.minLength ?? ''}
                className={fieldErrors?.length ? 'invalid' : undefined}
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
                step={1}
                value={field.rules.maxLength ?? ''}
                className={fieldErrors?.length ? 'invalid' : undefined}
                onChange={(event) =>
                  change((current) => setFieldRule(current, 'maxLength', event.target.value === '' ? undefined : Number(event.target.value)))
                }
                placeholder="Ej. 100"
              />
              {fieldErrors?.length && <span className="field-error">{fieldErrors.length}</span>}
            </div>
          </>
        )}

        <div className="form-group">
          <label>Expresión regular (Regex)</label>
          <input
            value={field.rules.pattern ?? ''}
            className={fieldErrors?.pattern ? 'invalid' : undefined}
            aria-invalid={Boolean(fieldErrors?.pattern)}
            onChange={(event) => change((current) => setFieldRule(current, 'pattern', event.target.value || undefined))}
            placeholder="Ej. ^[A-Z0-9]+$"
          />
          {fieldErrors?.pattern && <span className="field-error">{fieldErrors.pattern}</span>}
        </div>

        <div className="form-group">
          <label>Mensaje de error personalizado (Obligatorio)</label>
          <input
            value={field.rules.errorMessages?.required ?? ''}
            onChange={(event) => change((current) => setFieldErrorMessage(current, 'required', event.target.value))}
            placeholder="Ej. Este campo es requerido"
          />
        </div>

        <div className="form-group">
          <label>Mensaje de error (formato inválido / regex)</label>
          <input
            value={field.rules.errorMessages?.pattern ?? ''}
            onChange={(event) => change((current) => setFieldErrorMessage(current, 'pattern', event.target.value))}
            placeholder="Ej. El formato no es válido"
          />
        </div>

        <div className="form-group">
          <label>Mensaje de error (tipo de dato incorrecto)</label>
          <input
            value={field.rules.errorMessages?.type ?? ''}
            onChange={(event) => change((current) => setFieldErrorMessage(current, 'type', event.target.value))}
            placeholder="Ej. Ingresá un valor válido"
          />
        </div>

        {acceptsLengthRules && (
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
        {/* Obligatoriedad fija y condicional son excluyentes: tenerlas juntas es
            ambiguo y la fija gana en silencio. Se deshabilita la que sobra en vez
            de dejar configurar algo que el contrato después rechaza. */}
        <label title={conditionalRequired ? REQUIRED_CONFLICT_MESSAGE : undefined}>
          <input
            type="checkbox"
            checked={Boolean(field.rules.required)}
            disabled={conditionalRequired}
            onChange={(event) => change((current) => setFieldRule(current, 'required', event.target.checked))}
          />
          Obligatorio
        </label>
        {acceptsReadOnly && (
          <label>
            <input
              type="checkbox"
              checked={Boolean(field.readOnly)}
              onChange={(event) => change((current) => setFieldReadOnly(current, event.target.checked))}
            />
            Solo lectura
          </label>
        )}
        {!repeater && (
          <>
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
            <label title={fixedRequired ? REQUIRED_CONFLICT_MESSAGE : undefined}>
              <input
                type="checkbox"
                checked={Boolean(field.conditions?.required)}
                disabled={fixedRequired}
                onChange={(event) => toggleCondition('required', event.target.checked)}
              />
              Obligatoriedad condicional
            </label>
          </>
        )}
      </div>
      {fieldErrors?.readOnly && <span className="field-error">{fieldErrors.readOnly}</span>}
      {!repeater && (fixedRequired || conditionalRequired) && (
        <span className="hint">
          {fixedRequired
            ? 'Obligatorio siempre que el campo esté visible y habilitado. Si se oculta o se deshabilita por una condición, no se exige y no se envía.'
            : 'Obligatorio solo cuando se cumple la condición, y siempre que el campo esté visible y habilitado.'}
        </span>
      )}
      {repeater && (
        <span className="hint">Las celdas de una grilla no admiten lógica condicional.</span>
      )}

      {!repeater && candidates.length > 0 && (
        <>
          <ConditionEditor
            label="Visibilidad"
            condition={field.conditions?.visible}
            otherFields={candidates}
            error={fieldErrors?.conditions}
            onChange={(value) => change((current) => setFieldCondition(current, 'visible', value))}
          />
          <ConditionEditor
            label="Habilitación"
            condition={field.conditions?.enabled}
            otherFields={candidates}
            error={fieldErrors?.conditions}
            onChange={(value) => change((current) => setFieldCondition(current, 'enabled', value))}
          />
          <ConditionEditor
            label="Obligatoriedad"
            condition={field.conditions?.required}
            otherFields={candidates}
            error={fieldErrors?.conditions}
            onChange={(value) => change((current) => setFieldCondition(current, 'required', value))}
          />
        </>
      )}
    </div>
  );
}
