import { Controller } from 'react-hook-form';
import type { FormField } from '@tramites/form-contracts';
import { isFieldEnabled, isFieldRequired, isFieldVisible } from '@tramites/form-contracts';
import type { FormValues } from '../../../../shared/types/form-values';
import { valuesByFieldId } from '../../model/field-state';
import type { FieldControlProps } from './types';
import { getFieldRenderer } from './registry';

type DynamicFieldProps = Omit<FieldControlProps, 'enabled' | 'options'> & {
  values: FormValues;
  errors: Record<string, { message?: string } | undefined>;
  fieldMap: Map<string, FormField>;
};

export function DynamicField({ field, control, values, errors, fieldMap }: DynamicFieldProps) {
  const byId = valuesByFieldId(fieldMap, values);
  if (!isFieldVisible(field, byId)) return null;
  const enabled = isFieldEnabled(field, byId);
  const required = isFieldRequired(field, byId);
  const error = errors[field.fieldName]?.message;
  const options = field.options ?? [];
  const renderField = getFieldRenderer(field.type);

  return (
    <div className={`field field-${field.width ?? 'full'}`}>
      <label htmlFor={field.id}>
        {field.label}
        {required && <span className="required"> *</span>}
      </label>
      {field.helpText && <small>{field.helpText}</small>}
      <Controller
        name={field.fieldName}
        control={control}
        defaultValue={field.defaultValue}
        render={({ field: controllerField, fieldState }) => (
          <>
            {renderField({ field, controllerField, enabled, options })}
            {(fieldState.error?.message || error) && (
              <span className="field-error">{fieldState.error?.message || error}</span>
            )}
          </>
        )}
      />
    </div>
  );
}
