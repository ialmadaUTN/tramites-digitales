'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { AllowedMimeType, FieldType, FormDefinition, FormField, MaskKind } from '@tramites/form-contracts';
import { isMaskCompatible } from '@tramites/form-contracts/field-rules';
import { REQUIRED_CONFLICT_MESSAGE } from '@tramites/form-contracts/required-semantics';
import {
  changeFieldType,
  clearFieldConfiguration,
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
  type FieldConfigurationKey,
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
  containerId?: string;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
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

const CONFIGURATION_ORDER: FieldConfigurationKey[] = [
  'presentation',
  'layout',
  'defaultValue',
  'required',
  'limits',
  'pattern',
  'mask',
  'messages',
  'readOnly',
  'files',
  'conditions',
];

const CONFIGURATION_LABELS: Record<FieldConfigurationKey, string> = {
  presentation: 'Textos de ayuda',
  layout: 'Distribución',
  defaultValue: 'Valor inicial',
  required: 'Obligatoriedad',
  limits: 'Límites',
  pattern: 'Expresión regular',
  mask: 'Máscara',
  messages: 'Mensajes de error',
  readOnly: 'Solo lectura',
  files: 'Reglas de archivos',
  conditions: 'Lógica condicional',
};

const CONFIGURATION_DESCRIPTIONS: Record<FieldConfigurationKey, string> = {
  presentation: 'Placeholder y texto de ayuda',
  layout: 'Ancho del campo dentro de la grilla',
  defaultValue: 'Valor que aparece al abrir el formulario',
  required: 'Exigir una respuesta al completar',
  limits: 'Mínimos y máximos de caracteres o números',
  pattern: 'Formato personalizado con una regex',
  mask: 'Formato guiado para teléfonos, DNI o CUIT',
  messages: 'Reemplazar mensajes de validación',
  readOnly: 'Mostrar el valor sin permitir editarlo',
  files: 'Cantidad y tipos de archivos permitidos',
  conditions: 'Mostrar, habilitar, incluir o exigir según una regla',
};

function hasPersistedConfiguration(field: FormField, key: FieldConfigurationKey): boolean {
  switch (key) {
    case 'presentation':
      return Boolean(field.placeholder?.trim() || field.helpText?.trim());
    case 'layout':
      return field.width === 'half';
    case 'defaultValue':
      return field.defaultValue !== undefined;
    case 'required':
      return Boolean(field.rules.required);
    case 'limits':
      return field.rules.min !== undefined || field.rules.max !== undefined || field.rules.minLength !== undefined || field.rules.maxLength !== undefined;
    case 'pattern':
      return Boolean(field.rules.pattern);
    case 'mask':
      return Boolean(field.maskKind);
    case 'messages':
      return Object.keys(field.rules.errorMessages ?? {}).length > 0;
    case 'readOnly':
      return Boolean(field.readOnly);
    case 'files':
      return field.minFiles !== undefined || field.maxFiles !== undefined || field.allowedMimeTypes !== undefined;
    case 'conditions':
      return Object.values(field.conditions ?? {}).some(Boolean);
  }
}

function supportsConfiguration(field: FormField, key: FieldConfigurationKey, repeater: boolean, hasConditionSource: boolean): boolean {
  switch (key) {
    case 'defaultValue':
      return field.type !== 'fileUpload';
    case 'limits':
      return field.type === 'number' || LENGTH_RULE_FIELD_TYPES.includes(field.type);
    case 'mask':
      return MASK_FIELD_TYPES.includes(field.type);
    case 'readOnly':
      return !READ_ONLY_BLOCKED_FIELD_TYPES.includes(field.type);
    case 'files':
      return field.type === 'fileUpload';
    case 'conditions':
      // Una condición guardada se mantiene visible aunque la fuente que la
      // originó ya no esté disponible: así el autor puede quitarla y reparar
      // la definición en lugar de quedar con una configuración escondida.
      return !repeater && (hasConditionSource || hasPersistedConfiguration(field, key));
    default:
      return true;
  }
}

function configurationSummary(field: FormField, key: FieldConfigurationKey): string {
  switch (key) {
    case 'presentation':
      return [field.placeholder ? 'placeholder' : '', field.helpText ? 'ayuda' : ''].filter(Boolean).join(' · ') || 'Sin textos configurados';
    case 'layout':
      return field.width === 'half' ? 'Media columna' : 'Ancho completo';
    case 'defaultValue':
      return 'Valor inicial configurado';
    case 'required':
      return field.rules.required ? 'Obligatorio siempre' : 'Sin obligatoriedad fija';
    case 'limits': {
      const values = [field.rules.minLength !== undefined ? `mín. ${field.rules.minLength} caracteres` : '', field.rules.maxLength !== undefined ? `máx. ${field.rules.maxLength} caracteres` : '', field.rules.min !== undefined ? `mín. ${field.rules.min}` : '', field.rules.max !== undefined ? `máx. ${field.rules.max}` : ''];
      return values.filter(Boolean).join(' · ') || 'Sin límites';
    }
    case 'pattern':
      return field.rules.pattern ? `/${field.rules.pattern}/` : 'Sin expresión configurada';
    case 'mask':
      return MASK_OPTIONS.find((mask) => mask.value === field.maskKind)?.label ?? 'Sin máscara';
    case 'messages':
      return `${Object.keys(field.rules.errorMessages ?? {}).length} personalizados`;
    case 'readOnly':
      return 'No editable por la persona usuaria';
    case 'files':
      return `${field.minFiles ?? 0}–${field.maxFiles ?? 5} archivos`;
    case 'conditions': {
      const count = Object.values(field.conditions ?? {}).filter(Boolean).length;
      return `${count} ${count === 1 ? 'regla activa' : 'reglas activas'}`;
    }
  }
}

function errorConfigurationKeys(errors?: FieldEditorErrors): FieldConfigurationKey[] {
  if (!errors) return [];
  return [
    errors.defaultValue ? 'defaultValue' : undefined,
    errors.pattern ? 'pattern' : undefined,
    errors.length || errors.range ? 'limits' : undefined,
    errors.mask ? 'mask' : undefined,
    errors.files ? 'files' : undefined,
    errors.readOnly ? 'readOnly' : undefined,
    errors.conditions ? 'conditions' : undefined,
  ].filter((key): key is FieldConfigurationKey => Boolean(key));
}

function ConfigurationCard({
  title,
  summary,
  error,
  open,
  onToggle,
  onRemove,
  children,
}: {
  title: string;
  summary: string;
  error?: string;
  open: boolean;
  onToggle: () => void;
  onRemove?: () => void;
  children: ReactNode;
}) {
  return (
    <section className={`configuration-card${error ? ' has-error' : ''}${open ? ' is-open' : ''}`}>
      <div className="configuration-card-head">
        <button type="button" className="configuration-card-trigger" onClick={onToggle} aria-expanded={open}>
          <span className="configuration-card-copy">
            <strong>{title}</strong>
            <span>{summary}</span>
          </span>
          <span className="configuration-card-state">{error ? 'Revisar' : open ? 'Ocultar' : 'Editar'}</span>
        </button>
        {onRemove && (
          <button type="button" className="configuration-card-remove" onClick={onRemove} aria-label={`Quitar configuración: ${title}`} title={`Quitar ${title}`}>
            ×
          </button>
        )}
      </div>
      {open && <div className="configuration-card-body">{children}</div>}
    </section>
  );
}

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

export function FieldEditor({ field, index, definition, containerId: _containerId, canMoveUp = true, canMoveDown = true, fieldErrors, repeater = false, setDefinition }: FieldEditorProps) {
  const change = (update: (current: FormField) => FormField) => setDefinition(updateField(definition, field.id, update));
  const candidates = otherFields(definition, field.id);
  const fallbackConditionSource = candidates[0]
    ? { kind: 'field' as const, fieldId: candidates[0].id }
    : (definition.externalVariables?.[0] ? { kind: 'external' as const, variable: definition.externalVariables[0].name } : undefined);
  const toggleCondition = (key: ConditionKey, enabled: boolean) =>
    change((current) => enabled && !fallbackConditionSource ? current : toggleFieldCondition(current, key, enabled, fallbackConditionSource ?? ''));

  const acceptsLengthRules = LENGTH_RULE_FIELD_TYPES.includes(field.type);
  const acceptsMask = MASK_FIELD_TYPES.includes(field.type);
  const acceptsReadOnly = !READ_ONLY_BLOCKED_FIELD_TYPES.includes(field.type);
  const fixedRequired = Boolean(field.rules.required);
  const conditionalRequired = Boolean(field.conditions?.required);
  /**
   * Cada opción se deshabilita solo si la **otra** está activa y ella no.
   *
   * Si se deshabilitaran ambas cuando las dos están marcadas, una definición
   * guardada antes de esta regla quedaría irreparable: el editor bloquea guardar
   * por el conflicto y no deja desmarcar ninguna de las dos para resolverlo.
   */
  const requiredConflict = fixedRequired && conditionalRequired;
  const lockFixedRequired = conditionalRequired && !requiredConflict;
  const lockConditionalRequired = fixedRequired && !requiredConflict;
  const hasConditionSource = candidates.length > 0 || (definition.externalVariables?.length ?? 0) > 0;
  const persistedConfigurations = CONFIGURATION_ORDER.filter((key) => hasPersistedConfiguration(field, key));
  const initialErrors = errorConfigurationKeys(fieldErrors);
  const [activeConfigurations, setActiveConfigurations] = useState<Set<FieldConfigurationKey>>(
    () => new Set(persistedConfigurations),
  );
  const [expandedConfigurations, setExpandedConfigurations] = useState<Set<FieldConfigurationKey>>(
    () => new Set(initialErrors),
  );
  const [optionsExpanded, setOptionsExpanded] = useState(Boolean(fieldErrors?.options));
  const [configurationMenuOpen, setConfigurationMenuOpen] = useState(false);

  useEffect(() => {
    setActiveConfigurations((current) => {
      const next = new Set([...current].filter((key) => supportsConfiguration(field, key, repeater, hasConditionSource)));
      persistedConfigurations.forEach((key) => next.add(key));
      return next;
    });
  }, [field.id, field.type, repeater, hasConditionSource]);

  useEffect(() => {
    if (initialErrors.length === 0) return;
    setExpandedConfigurations((current) => new Set([...current, ...initialErrors]));
  }, [field.id, initialErrors.join('|')]);

  const isConfigurationActive = (key: FieldConfigurationKey) => activeConfigurations.has(key) || persistedConfigurations.includes(key);
  const toggleConfiguration = (key: FieldConfigurationKey) => {
    setExpandedConfigurations((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const addConfiguration = (key: FieldConfigurationKey) => {
    setActiveConfigurations((current) => new Set(current).add(key));
    setExpandedConfigurations((current) => new Set(current).add(key));
  };
  const removeConfiguration = (key: FieldConfigurationKey) => {
    setActiveConfigurations((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
    setExpandedConfigurations((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
    change((current) => clearFieldConfiguration(current, key));
  };
  const handleTypeChange = (type: FieldType) => {
    const next = changeFieldType(field, type);
    setDefinition(updateField(definition, field.id, () => next));
    setActiveConfigurations((current) => new Set([...current].filter((key) => supportsConfiguration(next, key, repeater, hasConditionSource))));
  };
  const availableConfigurations = CONFIGURATION_ORDER.filter(
    (key) => supportsConfiguration(field, key, repeater, hasConditionSource) && !isConfigurationActive(key),
  );

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
          {(field.conditions?.visible || field.conditions?.enabled || field.conditions?.included || field.conditions?.required) && (
            <span className="badge badge-info">Condicional</span>
          )}
        </div>

        <div className="toolbar-actions">
          <button
            type="button"
            className="button sm ghost"
            onClick={() => setDefinition(moveField(definition, field.id, -1))}
            disabled={!canMoveUp}
            title="Mover arriba"
          >
            ↑
          </button>
          <button
            type="button"
            className="button sm ghost"
            onClick={() => setDefinition(moveField(definition, field.id, 1))}
            disabled={!canMoveDown}
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
            onChange={(event) => handleTypeChange(event.target.value as FieldType)}
          >
            {(repeater ? REPEATER_FIELD_TYPES : FIELD_TYPES).map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type] || type}
              </option>
            ))}
          </select>
          {fieldErrors?.type && <span className="field-error">{fieldErrors.type}</span>}
        </div>

        {isConfigurationActive('layout') && (
          <ConfigurationCard
            title={CONFIGURATION_LABELS.layout}
            summary={configurationSummary(field, 'layout')}
            open={expandedConfigurations.has('layout')}
            onToggle={() => toggleConfiguration('layout')}
            onRemove={() => removeConfiguration('layout')}
          >
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
          </ConfigurationCard>
        )}

        {isConfigurationActive('defaultValue') && field.type !== 'fileUpload' && (
          <ConfigurationCard
            title={CONFIGURATION_LABELS.defaultValue}
            summary={configurationSummary(field, 'defaultValue')}
            error={fieldErrors?.defaultValue}
            open={expandedConfigurations.has('defaultValue')}
            onToggle={() => toggleConfiguration('defaultValue')}
            onRemove={() => removeConfiguration('defaultValue')}
          >
            <div className="form-group">
              <label>Valor inicial por defecto</label>
              <DefaultValueControl field={field} onChange={(next) => change(() => next)} />
              {fieldErrors?.defaultValue && <span className="field-error">{fieldErrors.defaultValue}</span>}
            </div>
          </ConfigurationCard>
        )}

        {isConfigurationActive('presentation') && (
          <ConfigurationCard
            title={CONFIGURATION_LABELS.presentation}
            summary={configurationSummary(field, 'presentation')}
            open={expandedConfigurations.has('presentation')}
            onToggle={() => toggleConfiguration('presentation')}
            onRemove={() => removeConfiguration('presentation')}
          >
            <div className="form-grid">
              <div className="form-group">
                <label>Texto borrador (Placeholder)</label>
                <input
                  value={field.placeholder ?? ''}
                  onChange={(event) => change((current) => ({ ...current, placeholder: event.target.value }))}
                  placeholder="Ej. Ingrese su número..."
                />
              </div>
              <div className="form-group">
                <label>Texto de ayuda (Help text)</label>
                <input
                  value={field.helpText ?? ''}
                  onChange={(event) => change((current) => ({ ...current, helpText: event.target.value }))}
                  placeholder="Ej. Se encuentra en el frente de la credencial"
                />
              </div>
            </div>
          </ConfigurationCard>
        )}

        {OPTION_FIELD_TYPES.includes(field.type) && (
          <ConfigurationCard
            title="Opciones del catálogo"
            summary={`${field.options?.length ?? 0} ${(field.options?.length ?? 0) === 1 ? 'opción' : 'opciones'}`}
            error={fieldErrors?.options}
            open={optionsExpanded || Boolean(fieldErrors?.options)}
            onToggle={() => setOptionsExpanded((open) => !open)}
          >
            <OptionsEditor
              options={field.options}
              error={fieldErrors?.options}
              onChange={(options) => change((current) => ({ ...current, options }))}
            />
            {fieldErrors?.options && <span className="field-error">{fieldErrors.options}</span>}
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
          </ConfigurationCard>
        )}
        {isConfigurationActive('mask') && acceptsMask && (
          <ConfigurationCard
            title={CONFIGURATION_LABELS.mask}
            summary={configurationSummary(field, 'mask')}
            error={fieldErrors?.mask}
            open={expandedConfigurations.has('mask')}
            onToggle={() => toggleConfiguration('mask')}
            onRemove={() => removeConfiguration('mask')}
          >
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
          </ConfigurationCard>
        )}
        {isConfigurationActive('files') && field.type === 'fileUpload' && (
          <ConfigurationCard
            title={CONFIGURATION_LABELS.files}
            summary={configurationSummary(field, 'files')}
            error={fieldErrors?.files}
            open={expandedConfigurations.has('files')}
            onToggle={() => toggleConfiguration('files')}
            onRemove={() => removeConfiguration('files')}
          >
            <div className="form-grid">
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
                            return { ...current, allowedMimeTypes: nextTypes.length === allTypes.length ? undefined : nextTypes };
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
                {fieldErrors?.files ? <span className="field-error">{fieldErrors.files}</span> : <span className="hint">Solo se admiten PDF, JPG y PNG de hasta 10 MB por archivo.</span>}
              </div>
            </div>
          </ConfigurationCard>
        )}
      </div>

      {/* Reglas de validación */}
      {isConfigurationActive('limits') && (field.type === 'number' || acceptsLengthRules) && (
        <ConfigurationCard
          title={CONFIGURATION_LABELS.limits}
          summary={configurationSummary(field, 'limits')}
          error={fieldErrors?.length || fieldErrors?.range}
          open={expandedConfigurations.has('limits')}
          onToggle={() => toggleConfiguration('limits')}
          onRemove={() => removeConfiguration('limits')}
        >
          <div className="form-grid">
            {field.type === 'number' && (
              <>
                <div className="form-group">
                  <label>Mínimo numérico</label>
                  <input type="number" value={field.rules.min ?? ''} className={fieldErrors?.range ? 'invalid' : undefined} onChange={(event) => change((current) => setFieldRule(current, 'min', event.target.value === '' ? undefined : Number(event.target.value)))} placeholder="Sin límite" />
                </div>
                <div className="form-group">
                  <label>Máximo numérico</label>
                  <input type="number" value={field.rules.max ?? ''} className={fieldErrors?.range ? 'invalid' : undefined} onChange={(event) => change((current) => setFieldRule(current, 'max', event.target.value === '' ? undefined : Number(event.target.value)))} placeholder="Sin límite" />
                  {fieldErrors?.range && <span className="field-error">{fieldErrors.range}</span>}
                </div>
              </>
            )}
            {acceptsLengthRules && (
              <>
                <div className="form-group">
                  <label>Mínimo de caracteres</label>
                  <input type="number" min={0} step={1} value={field.rules.minLength ?? ''} className={fieldErrors?.length ? 'invalid' : undefined} onChange={(event) => change((current) => setFieldRule(current, 'minLength', event.target.value === '' ? undefined : Number(event.target.value)))} placeholder="Ej. 3" />
                </div>
                <div className="form-group">
                  <label>Máximo de caracteres</label>
                  <input type="number" min={0} step={1} value={field.rules.maxLength ?? ''} className={fieldErrors?.length ? 'invalid' : undefined} onChange={(event) => change((current) => setFieldRule(current, 'maxLength', event.target.value === '' ? undefined : Number(event.target.value)))} placeholder="Ej. 100" />
                  {fieldErrors?.length && <span className="field-error">{fieldErrors.length}</span>}
                </div>
              </>
            )}
          </div>
        </ConfigurationCard>
      )}

      {isConfigurationActive('pattern') && (
        <ConfigurationCard
          title={CONFIGURATION_LABELS.pattern}
          summary={configurationSummary(field, 'pattern')}
          error={fieldErrors?.pattern}
          open={expandedConfigurations.has('pattern')}
          onToggle={() => toggleConfiguration('pattern')}
          onRemove={() => removeConfiguration('pattern')}
        >
          <div className="form-group">
            <label>Expresión regular (Regex)</label>
            <input value={field.rules.pattern ?? ''} className={fieldErrors?.pattern ? 'invalid' : undefined} aria-invalid={Boolean(fieldErrors?.pattern)} onChange={(event) => change((current) => setFieldRule(current, 'pattern', event.target.value || undefined))} placeholder="Ej. ^[A-Z0-9]+$" />
            {fieldErrors?.pattern && <span className="field-error">{fieldErrors.pattern}</span>}
          </div>
        </ConfigurationCard>
      )}

      {isConfigurationActive('messages') && (
        <ConfigurationCard
          title={CONFIGURATION_LABELS.messages}
          summary={configurationSummary(field, 'messages')}
          open={expandedConfigurations.has('messages')}
          onToggle={() => toggleConfiguration('messages')}
          onRemove={() => removeConfiguration('messages')}
        >
          <div className="form-grid">
            <div className="form-group">
              <label>Mensaje de error personalizado (Obligatorio)</label>
              <input value={field.rules.errorMessages?.required ?? ''} onChange={(event) => change((current) => setFieldErrorMessage(current, 'required', event.target.value))} placeholder="Ej. Este campo es requerido" />
            </div>
            <div className="form-group">
              <label>Mensaje de error (formato inválido / regex)</label>
              <input value={field.rules.errorMessages?.pattern ?? ''} onChange={(event) => change((current) => setFieldErrorMessage(current, 'pattern', event.target.value))} placeholder="Ej. El formato no es válido" />
            </div>
            <div className="form-group">
              <label>Mensaje de error (tipo de dato incorrecto)</label>
              <input value={field.rules.errorMessages?.type ?? ''} onChange={(event) => change((current) => setFieldErrorMessage(current, 'type', event.target.value))} placeholder="Ej. Ingresá un valor válido" />
            </div>
            {acceptsLengthRules && (
              <>
                <div className="form-group">
                  <label>Mensaje de error (mínimo de caracteres)</label>
                  <input value={field.rules.errorMessages?.minLength ?? ''} onChange={(event) => change((current) => setFieldErrorMessage(current, 'minLength', event.target.value))} placeholder="Ej. Escribí al menos 3 caracteres" />
                </div>
                <div className="form-group">
                  <label>Mensaje de error (máximo de caracteres)</label>
                  <input value={field.rules.errorMessages?.maxLength ?? ''} onChange={(event) => change((current) => setFieldErrorMessage(current, 'maxLength', event.target.value))} placeholder="Ej. Superaste el máximo permitido" />
                </div>
              </>
            )}
            {field.type === 'number' && (
              <>
                <div className="form-group">
                  <label>Mensaje de error (mínimo numérico)</label>
                  <input value={field.rules.errorMessages?.min ?? ''} onChange={(event) => change((current) => setFieldErrorMessage(current, 'min', event.target.value))} placeholder="Ej. El valor es demasiado bajo" />
                </div>
                <div className="form-group">
                  <label>Mensaje de error (máximo numérico)</label>
                  <input value={field.rules.errorMessages?.max ?? ''} onChange={(event) => change((current) => setFieldErrorMessage(current, 'max', event.target.value))} placeholder="Ej. El valor es demasiado alto" />
                </div>
              </>
            )}
          </div>
        </ConfigurationCard>
      )}

      {isConfigurationActive('required') && (
        <ConfigurationCard
          title={CONFIGURATION_LABELS.required}
          summary={configurationSummary(field, 'required')}
          open={expandedConfigurations.has('required')}
          onToggle={() => toggleConfiguration('required')}
          onRemove={() => removeConfiguration('required')}
        >
          <label className="checkbox-row inline-control" title={lockFixedRequired || requiredConflict ? REQUIRED_CONFLICT_MESSAGE : undefined}>
            <input
              type="checkbox"
              checked={Boolean(field.rules.required)}
              disabled={lockFixedRequired}
              onChange={(event) => change((current) => setFieldRule(current, 'required', event.target.checked))}
            />
            Obligatorio
          </label>
          {!repeater && (fixedRequired || conditionalRequired) && (
            <span className="hint">
              {fixedRequired
                ? 'Obligatorio siempre que el campo esté visible y habilitado. Si se oculta o se deshabilita por una condición, no se exige y no se envía.'
                : 'Obligatorio solo cuando se cumple la condición, y siempre que el campo esté visible y habilitado.'}
            </span>
          )}
        </ConfigurationCard>
      )}

      {isConfigurationActive('readOnly') && acceptsReadOnly && (
        <ConfigurationCard
          title={CONFIGURATION_LABELS.readOnly}
          summary={configurationSummary(field, 'readOnly')}
          error={fieldErrors?.readOnly}
          open={expandedConfigurations.has('readOnly')}
          onToggle={() => toggleConfiguration('readOnly')}
          onRemove={() => removeConfiguration('readOnly')}
        >
          <label className="checkbox-row inline-control">
            <input type="checkbox" checked={Boolean(field.readOnly)} onChange={(event) => change((current) => setFieldReadOnly(current, event.target.checked))} />
            Solo lectura
          </label>
          {fieldErrors?.readOnly && <span className="field-error">{fieldErrors.readOnly}</span>}
        </ConfigurationCard>
      )}

      {isConfigurationActive('conditions') && !repeater && (hasConditionSource || hasPersistedConfiguration(field, 'conditions')) && (
        <ConfigurationCard
          title={CONFIGURATION_LABELS.conditions}
          summary={configurationSummary(field, 'conditions')}
          error={fieldErrors?.conditions}
          open={expandedConfigurations.has('conditions')}
          onToggle={() => toggleConfiguration('conditions')}
          onRemove={() => removeConfiguration('conditions')}
        >
          <div className="checkbox-row inline-control">
            <label>
              <input type="checkbox" checked={Boolean(field.conditions?.visible)} onChange={(event) => toggleCondition('visible', event.target.checked)} />
              Visibilidad condicional
            </label>
            <label>
              <input type="checkbox" checked={Boolean(field.conditions?.enabled)} onChange={(event) => toggleCondition('enabled', event.target.checked)} />
              Habilitación condicional
            </label>
            <label>
              <input type="checkbox" checked={Boolean(field.conditions?.included)} onChange={(event) => toggleCondition('included', event.target.checked)} />
              Inclusión condicional
            </label>
            <label title={lockConditionalRequired || requiredConflict ? REQUIRED_CONFLICT_MESSAGE : undefined}>
              <input type="checkbox" checked={Boolean(field.conditions?.required)} disabled={lockConditionalRequired} onChange={(event) => toggleCondition('required', event.target.checked)} />
              Obligatoriedad condicional
            </label>
          </div>
          <ConditionEditor label="Visibilidad" condition={field.conditions?.visible} otherFields={candidates} externalVariables={definition.externalVariables} error={fieldErrors?.conditions} onChange={(value) => change((current) => setFieldCondition(current, 'visible', value))} />
          <ConditionEditor label="Habilitación" condition={field.conditions?.enabled} otherFields={candidates} externalVariables={definition.externalVariables} error={fieldErrors?.conditions} onChange={(value) => change((current) => setFieldCondition(current, 'enabled', value))} />
          <ConditionEditor label="Inclusión en el payload" condition={field.conditions?.included} otherFields={candidates} externalVariables={definition.externalVariables} error={fieldErrors?.conditions} onChange={(value) => change((current) => setFieldCondition(current, 'included', value))} />
          <ConditionEditor label="Obligatoriedad" condition={field.conditions?.required} otherFields={candidates} externalVariables={definition.externalVariables} error={fieldErrors?.conditions} onChange={(value) => change((current) => setFieldCondition(current, 'required', value))} />
        </ConfigurationCard>
      )}
      {repeater && <span className="hint">Las celdas de una grilla no admiten lógica condicional.</span>}

      <div className="configuration-picker">
        <div>
          <strong>Configuración opcional</strong>
          <span className="hint">Agregá solo lo que este campo necesita.</span>
        </div>
        {availableConfigurations.length > 0 ? (
          <div className="configuration-menu">
            <button
              type="button"
              className="button secondary"
              aria-haspopup="menu"
              aria-expanded={configurationMenuOpen}
              onClick={() => setConfigurationMenuOpen((open) => !open)}
            >
              + Agregar configuración
            </button>
            {configurationMenuOpen && (
            <div className="configuration-menu-list" role="menu">
              {availableConfigurations.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    addConfiguration(key);
                    setConfigurationMenuOpen(false);
                  }}
                >
                  <span><strong>{CONFIGURATION_LABELS[key]}</strong><small>{CONFIGURATION_DESCRIPTIONS[key]}</small></span>
                  <span aria-hidden="true">+</span>
                </button>
              ))}
            </div>
            )}
          </div>
        ) : (
          <span className="hint">No hay más configuraciones compatibles.</span>
        )}
      </div>
    </div>
  );
}
