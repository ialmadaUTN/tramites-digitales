import { useEffect } from 'react';
import { Controller, useFieldArray, type Control } from 'react-hook-form';
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
        <div className="repeater-cell-control">
          {renderField({ field, controllerField: controllerField as never, enabled: true, options: field.options ?? [] })}
          {fieldState.error?.message && <span className="field-error">{fieldState.error.message}</span>}
        </div>
      )}
    />
  );
}

export function DynamicRepeater({ container, control }: DynamicRepeaterProps) {
  const fieldName = container.fieldName;
  const { fields, append, remove, replace } = useFieldArray({ control: control as Control<any>, name: fieldName ?? '__invalid_repeater__' });
  const maxRows = container.maxRows ?? 50;
  const minRows = container.minRows ?? 0;

  useEffect(() => {
    if (fieldName && fields.length === 0 && minRows > 0) {
      replace(Array.from({ length: minRows }, () => defaultRow(container)) as never);
    }
  }, [container, fieldName, fields.length, minRows, replace]);

  if (!fieldName) return null;

  return (
    <div className="repeater" aria-label={container.title}>
      <div className="repeater-table" role="table">
        <div className="repeater-row repeater-header" role="row">
          {container.fields.map((field) => <div className="repeater-cell" role="columnheader" key={field.id}>{field.label}</div>)}
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
              <button type="button" className="button sm danger" onClick={() => remove(rowIndex)} disabled={fields.length <= minRows}>
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="button secondary" onClick={() => append(defaultRow(container) as never)} disabled={fields.length >= maxRows}>
        + Agregar fila
      </button>
      <small className="hint">{fields.length} de {maxRows} fila(s) utilizadas.</small>
    </div>
  );
}
