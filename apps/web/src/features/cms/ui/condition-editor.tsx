'use client';

import type { ConditionGroup, FormField } from '@tramites/form-contracts';

type ConditionEditorProps = {
  label: string;
  condition?: ConditionGroup;
  otherFields: FormField[];
  onChange: (value: ConditionGroup) => void;
};

export function ConditionEditor({ label, condition, otherFields, onChange }: ConditionEditorProps) {
  if (!condition) return null;
  const rule = condition.rules[0] ?? { fieldId: otherFields[0]?.id ?? '', operator: 'equals' as const, value: '' };
  const sourceField = otherFields.find((candidate) => candidate.id === rule.fieldId);

  const update = (next: Partial<typeof rule>) =>
    onChange({
      ...condition,
      rules: [{ fieldId: next.fieldId ?? rule.fieldId, operator: next.operator ?? rule.operator, value: next.value ?? rule.value }],
    });

  const parseExpectedValue = (raw: string) => {
    if (sourceField?.type === 'number') {
      const parsed = Number(raw);
      return raw.trim() === '' || Number.isNaN(parsed) ? raw : parsed;
    }
    if (sourceField?.type === 'checkbox') {
      if (raw.trim().toLowerCase() === 'true') return true;
      if (raw.trim().toLowerCase() === 'false') return false;
    }
    return raw;
  };

  return (
    <div style={{ marginTop: 12, padding: 12, background: '#f1f5f9', borderRadius: 8, border: '1px solid #cbd5e1' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 12, fontWeight: 700, color: '#475569' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
        Lógica condicional: {label}
      </div>
      <div className="form-grid">
        <div className="form-group">
          <label>Depende del campo</label>
          <select value={rule.fieldId} onChange={(event) => update({ fieldId: event.target.value })}>
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
            onChange={(event) => update({ operator: event.target.value as ConditionGroup['rules'][number]['operator'] })}
          >
            <option value="equals">es igual a</option>
            <option value="notEquals">es distinto de</option>
            <option value="notEmpty">no está vacío</option>
            <option value="empty">está vacío</option>
          </select>
        </div>
        {rule.operator !== 'notEmpty' && rule.operator !== 'empty' && (
          <div className="form-group full">
            <label>Valor esperado</label>
            {sourceField?.options && sourceField.options.length > 0 ? (
              <select
                value={String(rule.value ?? '')}
                onChange={(event) => {
                  const selected = sourceField.options?.find((option) => String(option.value) === event.target.value);
                  update({ value: selected ? selected.value : event.target.value });
                }}
              >
                <option value="">Seleccioná una opción</option>
                {sourceField.options.map((option) => (
                  <option key={String(option.value)} value={String(option.value)}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : sourceField?.type === 'checkbox' ? (
              <select
                value={String(rule.value ?? '')}
                onChange={(event) => update({ value: parseExpectedValue(event.target.value) })}
              >
                <option value="">Seleccioná un valor</option>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : (
              <input
                type={sourceField?.type === 'number' ? 'number' : 'text'}
                value={String(rule.value ?? '')}
                onChange={(event) => update({ value: parseExpectedValue(event.target.value) })}
                placeholder={sourceField?.type === 'number' ? 'Ej. 18' : 'Ej. SI / texto esperado'}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
