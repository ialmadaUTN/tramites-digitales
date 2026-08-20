import { useEffect } from 'react';
import { Controller, useFieldArray, useFormState, type Control } from 'react-hook-form';
import type { FormContainer, FormField } from '@tramites/form-contracts';
import { getFieldRenderer } from '../fields/registry';
import type { FormValues } from '../../../../shared/types/form-values';

type DynamicRepeaterProps = {
  container: FormContainer;
  control: Control<FormValues>;
  enabled?: boolean;
};

function defaultRow(container: FormContainer): Record<string, unknown> {
  return Object.fromEntries(container.fields.map((field) => [field.fieldName, field.defaultValue ?? (field.type === 'checkbox' ? false : '')]));
}

function RepeaterCell({ field, control, name }: { field: FormField; control: Control<FormValues>; name: string }) {
  const renderField = getFieldRenderer(field.type);
  return (
    <Controller
      name={name as never}
      control={control as Control<any>}
      render={({ field: controllerField, fieldState }) => (
        <div className={`repeater-cell-control${fieldState.error ? ' has-error' : ''}`}>
          {renderField({ field, controllerField: controllerField as never, enabled: true, options: field.options ?? [] })}
          {fieldState.error?.message && (
            <span className="field-error" role="alert">{fieldState.error.message}</span>
          )}
        </div>
      )}
    />
  );
}

/** Error del contenedor (cantidad de filas), distinto de los errores por celda. */
function rowCountError(errors: Record<string, unknown>, fieldName: string): string | undefined {
  const entry = errors[fieldName] as { message?: unknown; root?: { message?: unknown } } | undefined;
  const message = entry?.message ?? entry?.root?.message;
  return typeof message === 'string' ? message : undefined;
}

export function DynamicRepeater({ container, control }: DynamicRepeaterProps) {
  const fieldName = container.fieldName;
  const { fields, append, remove, replace } = useFieldArray({ control: control as Control<any>, name: fieldName ?? '__invalid_repeater__' });
  const { errors } = useFormState({ control });
  const maxRows = container.maxRows ?? 50;
  const minRows = container.minRows ?? 0;

  useEffect(() => {
    if (fieldName && fields.length === 0 && minRows > 0) {
      replace(Array.from({ length: minRows }, () => defaultRow(container)) as never);
    }
  }, [container, fieldName, fields.length, minRows, replace]);

  if (!fieldName) return null;

  const containerError = rowCountError(errors as Record<string, unknown>, fieldName);
  const atMax = fields.length >= maxRows;
  const atMin = fields.length <= minRows;

  return (
    <div className="repeater" aria-label={container.title}>
      <div className="repeater-table" role="table">
        <div className="repeater-row repeater-header" role="row">
          {container.fields.map((field) => (
            <div className="repeater-cell" role="columnheader" key={field.id}>
              {field.label}
              {field.rules.required && <span className="required" title="Obligatorio"> *</span>}
            </div>
          ))}
          <div className="repeater-cell repeater-actions" aria-hidden="true" />
        </div>
        {fields.map((row, rowIndex) => (
          <div className="repeater-row" role="row" key={row.id}>
            {container.fields.map((field) => (
              <div className="repeater-cell" role="cell" key={field.id}>
                <RepeaterCell field={field} control={control} name={`${fieldName}.${rowIndex}.${field.fieldName}`} />
              </div>
            ))}
            <div className="repeater-cell repeater-actions">
              <button
                type="button"
                className="button sm danger"
                onClick={() => remove(rowIndex)}
                disabled={atMin}
                title={atMin ? `La grilla requiere al menos ${minRows} fila(s)` : 'Eliminar fila'}
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="button secondary"
        onClick={() => append(defaultRow(container) as never)}
        disabled={atMax}
        title={atMax ? `La grilla admite hasta ${maxRows} fila(s)` : 'Agregar fila'}
      >
        + Agregar fila
      </button>
      <small className="hint">
        {fields.length} de {maxRows} fila(s) utilizadas{minRows > 0 ? ` · mínimo ${minRows}` : ''}.
      </small>
      {containerError && <span className="field-error" role="alert">{containerError}</span>}
    </div>
  );
}
