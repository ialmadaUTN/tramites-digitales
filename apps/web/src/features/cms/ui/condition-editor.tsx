'use client';

import type { ConditionGroup, ConditionOperator, ExternalVariable, ExternalVariableType, FormField, ScalarValue } from '@tramites/form-contracts';
import { CONDITION_OPERATORS } from '../model/constants';
import { addConditionRule, removeConditionRule, setConditionLogic, updateConditionRule } from '../model/definition';

type ConditionEditorProps = {
  label: string;
  condition?: ConditionGroup;
  otherFields: FormField[];
  externalVariables?: ExternalVariable[];
  error?: string;
  onChange: (value: ConditionGroup) => void;
};

const NUMERIC_OPERATORS: ConditionOperator[] = ['greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual'];

function valueKindOf(operator: ConditionOperator): 'none' | 'single' | 'list' {
  return CONDITION_OPERATORS.find((entry) => entry.value === operator)?.valueKind ?? 'single';
}

/** Convierte el texto del input al tipo que espera el campo de origen. */
function parseExpectedValue(raw: string, sourceField: FormField | undefined, operator: ConditionOperator, externalType?: ExternalVariableType): ScalarValue {
  if (sourceField?.type === 'number' || externalType === 'number' || NUMERIC_OPERATORS.includes(operator)) {
    const parsed = Number(raw);
    return raw.trim() === '' || Number.isNaN(parsed) ? raw : parsed;
  }
  if (sourceField?.type === 'checkbox' || externalType === 'boolean') {
    if (raw.trim().toLowerCase() === 'true') return true;
    if (raw.trim().toLowerCase() === 'false') return false;
  }
  return raw;
}

function asList(value: unknown): ScalarValue[] {
  return Array.isArray(value) ? (value as ScalarValue[]) : [];
}

function SingleValueControl({
  sourceField,
  externalType,
  operator,
  value,
  onChange,
}: {
  sourceField: FormField | undefined;
  externalType?: ExternalVariableType;
  operator: ConditionOperator;
  value: unknown;
  onChange: (next: ScalarValue) => void;
}) {
  const options = sourceField?.options ?? [];
  if (options.length > 0 && !NUMERIC_OPERATORS.includes(operator)) {
    return (
      <select
        value={String(value ?? '')}
        onChange={(event) => {
          const selected = options.find((option) => String(option.value) === event.target.value);
          onChange(selected ? selected.value : event.target.value);
        }}
      >
        <option value="">Seleccioná una opción</option>
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  if (sourceField?.type === 'checkbox' || externalType === 'boolean') {
    return (
      <select value={String(value ?? '')} onChange={(event) => onChange(parseExpectedValue(event.target.value, sourceField, operator, externalType))}>
        <option value="">Seleccioná un valor</option>
        <option value="true">Marcado (true)</option>
        <option value="false">Sin marcar (false)</option>
      </select>
    );
  }
  const numeric = sourceField?.type === 'number' || externalType === 'number' || NUMERIC_OPERATORS.includes(operator);
  return (
    <input
      type={numeric ? 'number' : sourceField?.type === 'date' ? 'date' : 'text'}
      value={String(value ?? '')}
      onChange={(event) => onChange(parseExpectedValue(event.target.value, sourceField, operator, externalType))}
      placeholder={numeric ? 'Ej. 18' : 'Ej. SI / texto esperado'}
    />
  );
}

function ListValueControl({
  sourceField,
  externalType,
  value,
  onChange,
}: {
  sourceField: FormField | undefined;
  externalType?: ExternalVariableType;
  value: unknown;
  onChange: (next: ScalarValue[]) => void;
}) {
  const options = sourceField?.options ?? [];
  const selected = asList(value);

  if (options.length > 0) {
    return (
      <div className="condition-value-list">
        {options.map((option) => {
          const checked = selected.some((item) => String(item) === String(option.value));
          return (
            <label className="condition-value-option" key={String(option.value)}>
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...selected.filter((item) => String(item) !== String(option.value)), option.value]
                      : selected.filter((item) => String(item) !== String(option.value)),
                  )
                }
              />
              {option.label}
            </label>
          );
        })}
      </div>
    );
  }

  return (
    <input
      type="text"
      value={selected.map(String).join(', ')}
      onChange={(event) =>
        onChange(
          event.target.value
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean)
            .map((part) => parseExpectedValue(part, sourceField, 'in', externalType)),
        )
      }
      placeholder="Valores separados por coma. Ej. si, tal_vez"
    />
  );
}

export function ConditionEditor({ label, condition, otherFields, externalVariables = [], error, onChange }: ConditionEditorProps) {
  if (!condition) return null;
  const fallbackSource = otherFields[0]
    ? { kind: 'field' as const, fieldId: otherFields[0].id }
    : (externalVariables[0] ? { kind: 'external' as const, variable: externalVariables[0].name } : '');

  return (
    <div className="condition-editor">
      <div className="condition-editor-head">
        <div className="condition-editor-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          Lógica condicional: {label}
        </div>
        <label className="condition-logic">
          Se cumplen
          <select
            value={condition.logic}
            onChange={(event) => onChange(setConditionLogic(condition, event.target.value as ConditionGroup['logic']))}
          >
            <option value="all">todas las reglas (Y)</option>
            <option value="any">al menos una regla (O)</option>
          </select>
        </label>
      </div>

      {condition.rules.map((rule, index) => {
        const conditionSource = rule.source;
        const sourceField = otherFields.find((candidate) => candidate.id === (
          conditionSource?.kind === 'field' ? conditionSource.fieldId : rule.fieldId
        ));
        const externalVariable = conditionSource?.kind === 'external'
          ? externalVariables.find((candidate) => candidate.name === conditionSource.variable)
          : undefined;
        const kind = valueKindOf(rule.operator);
        return (
          <div className="condition-rule" key={index}>
            <div className="form-grid">
              <div className="form-group">
                <label>Depende del campo</label>
                <select
                  value={conditionSource?.kind === 'external'
                    ? `external:${conditionSource.variable}`
                    : conditionSource?.kind === 'field' ? conditionSource.fieldId : rule.fieldId ?? ''}
                  onChange={(event) => {
                    const selected = event.target.value;
                    onChange(updateConditionRule(condition, index, selected.startsWith('external:')
                      ? { fieldId: undefined, source: { kind: 'external', variable: selected.slice('external:'.length) }, value: '' }
                      : { fieldId: undefined, source: { kind: 'field', fieldId: selected }, value: '' }));
                  }}
                >
                  {externalVariables.length > 0 && (
                    <optgroup label="Variables externas">
                      {externalVariables.map((variable) => (
                        <option key={variable.name} value={`external:${variable.name}`}>
                          {variable.label} ({variable.name})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {otherFields.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.label || candidate.fieldName || candidate.id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Operador</label>
                <select
                  value={rule.operator}
                  onChange={(event) => {
                    const operator = event.target.value as ConditionOperator;
                    const nextKind = valueKindOf(operator);
                    onChange(
                      updateConditionRule(condition, index, {
                        operator,
                        value: nextKind === 'list' ? asList(rule.value) : nextKind === 'none' ? undefined : rule.value,
                      }),
                    );
                  }}
                >
                  {CONDITION_OPERATORS.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </div>
              {kind !== 'none' && (
                <div className="form-group full">
                  <label>{kind === 'list' ? 'Valores aceptados' : 'Valor esperado'}</label>
                  {kind === 'list' ? (
                    <ListValueControl
                      sourceField={sourceField}
                      externalType={externalVariable?.type}
                      value={rule.value}
                      onChange={(next) => onChange(updateConditionRule(condition, index, { value: next }))}
                    />
                  ) : (
                    <SingleValueControl
                      sourceField={sourceField}
                      externalType={externalVariable?.type}
                      operator={rule.operator}
                      value={rule.value}
                      onChange={(next) => onChange(updateConditionRule(condition, index, { value: next }))}
                    />
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              className="button sm ghost"
              disabled={condition.rules.length <= 1}
              title={condition.rules.length <= 1 ? 'La condición necesita al menos una regla' : 'Quitar regla'}
              onClick={() => onChange(removeConditionRule(condition, index))}
            >
              Quitar regla
            </button>
          </div>
        );
      })}

      {(condition.groups ?? []).map((group, index) => (
        <div className="condition-group-nested" key={index}>
          <ConditionEditor
            label={`Grupo anidado ${index + 1}`}
            condition={group}
            otherFields={otherFields}
            externalVariables={externalVariables}
            onChange={(next) => onChange({ ...condition, groups: (condition.groups ?? []).map((candidate, candidateIndex) => candidateIndex === index ? next : candidate) })}
          />
          <button
            type="button"
            className="button sm ghost"
            title="Quitar grupo anidado"
            onClick={() => onChange({ ...condition, groups: (condition.groups ?? []).filter((_, candidateIndex) => candidateIndex !== index) })}
          >
            Quitar grupo
          </button>
        </div>
      ))}

      <button
        type="button"
        className="button sm secondary"
        disabled={otherFields.length === 0 && externalVariables.length === 0}
        onClick={() => onChange(addConditionRule(condition, fallbackSource))}
      >
        + Agregar regla
      </button>
      <button
        type="button"
        className="button sm secondary"
        disabled={otherFields.length === 0 && externalVariables.length === 0}
        onClick={() => onChange({
          ...condition,
          groups: [...(condition.groups ?? []), addConditionRule({ logic: 'all', rules: [] }, fallbackSource)],
        })}
      >
        + Agregar grupo anidado
      </button>
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
