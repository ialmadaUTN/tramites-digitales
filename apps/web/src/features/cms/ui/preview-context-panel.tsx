'use client';

import type {
  DynamicFormPreviewState,
  ExternalVariable,
  ExternalVariableValues,
} from '@tramites/form-contracts';

type PreviewContextPanelProps = {
  variables?: ExternalVariable[];
  values: ExternalVariableValues;
  state?: DynamicFormPreviewState;
  onChange: (name: string, value: string | number | boolean | undefined) => void;
  onReset: () => void;
};

function hasValue(values: ExternalVariableValues, name: string): boolean {
  return Object.prototype.hasOwnProperty.call(values, name);
}

function displayValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function statusLabel(value: boolean): string {
  return value ? 'Sí' : 'No';
}

export function PreviewContextPanel({ variables = [], values, state, onChange, onReset }: PreviewContextPanelProps) {
  return (
    <section className="preview-context-panel" aria-label="Contexto de prueba">
      <div className="preview-context-header">
        <div>
          <p className="eyebrow">Simulador local</p>
          <h3>Contexto de prueba</h3>
        </div>
        <button className="button" type="button" onClick={onReset} disabled={Object.keys(values).length === 0}>
          Restablecer
        </button>
      </div>
      <p className="hint">
        Cambiá las variables para probar las reglas del borrador. Estos valores solo viven en esta vista previa y no representan autorización.
      </p>

      {variables.length === 0 ? (
        <p className="preview-context-empty">No hay variables externas declaradas.</p>
      ) : (
        <div className="preview-context-fields">
          {variables.map((variable) => {
            const defined = hasValue(values, variable.name);
            const value = values[variable.name];
            const inputLabel = `${variable.label} (${variable.name})`;
            return (
              <div className="preview-context-field" key={variable.name}>
                <div className="preview-context-field-head">
                  <label htmlFor={`preview-context-${variable.name}`}>
                    {variable.label} <code>{variable.name}</code>
                  </label>
                  <span className="preview-context-badges">
                    <span className="badge badge-info">{variable.trust === 'trusted' ? 'Trusted' : 'Presentación'}</span>
                    <span className={`badge ${defined ? 'badge-success' : 'badge-muted'}`}>{defined ? 'Definida' : 'Ausente'}</span>
                  </span>
                </div>
                {variable.type === 'boolean' ? (
                  <label className="preview-context-checkbox">
                    <input
                      id={`preview-context-${variable.name}`}
                      aria-label={inputLabel}
                      type="checkbox"
                      checked={value === true}
                      onChange={(event) => onChange(variable.name, event.currentTarget.checked)}
                    />
                    <span>Verdadero</span>
                  </label>
                ) : (
                  <input
                    id={`preview-context-${variable.name}`}
                    aria-label={inputLabel}
                    type={variable.type === 'number' ? 'number' : 'text'}
                    inputMode={variable.type === 'number' ? 'decimal' : undefined}
                    value={variable.type === 'number'
                      ? (typeof value === 'number' ? value : '')
                      : displayValue(value)}
                    onChange={(event) => {
                      const rawValue = event.currentTarget.value;
                      if (rawValue === '') {
                        onChange(variable.name, undefined);
                      } else if (variable.type === 'number') {
                        const parsed = Number(rawValue);
                        onChange(variable.name, Number.isFinite(parsed) ? parsed : undefined);
                      } else {
                        onChange(variable.name, rawValue);
                      }
                    }}
                  />
                )}
                <span className="preview-context-type">Tipo: {variable.type}</span>
              </div>
            );
          })}
        </div>
      )}

      <details className="preview-context-details" open>
        <summary>Props enviadas a DynamicForm</summary>
        <pre aria-label="Props de contexto">{JSON.stringify(values, null, 2)}</pre>
      </details>

      {state && (
        <div className="preview-context-state">
          <p className="preview-context-state-title">Estado efectivo</p>
          <div className="preview-context-status-list">
            <span className={`badge ${state.visible ? 'badge-success' : 'badge-muted'}`}>Visible: {statusLabel(state.visible)}</span>
            <span className={`badge ${state.enabled ? 'badge-success' : 'badge-muted'}`}>Habilitado: {statusLabel(state.enabled)}</span>
            <span className={`badge ${state.included ? 'badge-success' : 'badge-muted'}`}>Incluido: {statusLabel(state.included)}</span>
          </div>
          <details className="preview-context-details" open>
            <summary>Payload simulado</summary>
            <pre aria-label="Payload simulado">{JSON.stringify(state.payload, null, 2)}</pre>
          </details>
        </div>
      )}
    </section>
  );
}
