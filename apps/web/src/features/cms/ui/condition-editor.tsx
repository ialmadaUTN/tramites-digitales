'use client';

import type { ConditionGroup, ConditionOperator, FormField, ScalarValue } from '@tramites/form-contracts';
import { CONDITION_OPERATORS } from '../model/constants';
import { addConditionRule, removeConditionRule, setConditionLogic, updateConditionRule } from '../model/definition';

type ConditionEditorProps = {
  label: string;
  condition?: ConditionGroup;
  otherFields: FormField[];
  error?: string;
  onChange: (value: ConditionGroup) => void;
};

const NUMERIC_OPERATORS: ConditionOperator[] = ['greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual'];

function valueKindOf(operator: ConditionOperator): 'none' | 'single' | 'list' {
  return CONDITION_OPERATORS.find((entry) => entry.value === operator)?.valueKind ?? 'single';
}

/** Convierte el texto del input al tipo que espera el campo de origen. */
function parseExpectedValue(raw: string, sourceField: FormField | undefined, operator: ConditionOperator): ScalarValue {
  if (sourceField?.type === 'number' || NUMERIC_OPERATORS.includes(operator)) {
    const parsed = Number(raw);
    return raw.trim() === '' || Number.isNaN(parsed) ? raw : parsed;
  }
  if (sourceField?.type === 'checkbox') {
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
  operator,
  value,
  onChange,
}: {
  sourceField: FormField | undefined;
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
  if (sourceField?.type === 'checkbox') {
    return (
      <select value={String(value ?? '')} onChange={(event) => onChange(parseExpectedValue(event.target.value, sourceField, operator))}>
        <option value="">Seleccioná un valor</option>
        <option value="true">Marcado (true)</option>
        <option value="false">Sin marcar (false)</option>
      </select>
    );
  }
  const numeric = sourceField?.type === 'number' || NUMERIC_OPERATORS.includes(operator);
  return (
    <input
      type={numeric ? 'number' : sourceField?.type === 'date' ? 'date' : 'text'}
      value={String(value ?? '')}
      onChange={(event) => onChange(parseExpectedValue(event.target.value, sourceField, operator))}
      placeholder={numeric ? 'Ej. 18' : 'Ej. SI / texto esperado'}
    />
  );
}

function ListValueControl({
  sourceField,
  value,
  onChange,
}: {
  sourceField: FormField | undefined;
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
            .map((part) => parseExpectedValue(part, sourceField, 'in')),
        )
      }
      placeholder="Valores separados por coma. Ej. si, tal_vez"
    />
  );
}

export function ConditionEditor({ label, condition, otherFields, error, onChange }: ConditionEditorProps) {
  if (!condition) return null;
  const fallbackFieldId = otherFields[0]?.id ?? '';

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
        const sourceField = otherFields.find((candidate) => candidate.id === rule.fieldId);
        const kind = valueKindOf(rule.operator);
        return (
          <div className="condition-rule" key={index}>
            <div className="form-grid">
              <div className="form-group">
                <label>Depende del campo</label>
                <select
                  value={rule.fieldId}
                  onChange={(event) => onChange(updateConditionRule(condition, index, { fieldId: event.target.value, value: '' }))}
                >
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
                      value={rule.value}
                      onChange={(next) => onChange(updateConditionRule(condition, index, { value: next }))}
                    />
                  ) : (
                    <SingleValueControl
                      sourceField={sourceField}
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

      <button
        type="button"
        className="button sm secondary"
        disabled={otherFields.length === 0}
        onClick={() => onChange(addConditionRule(condition, fallbackFieldId))}
      >
        + Agregar regla
      </button>
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
