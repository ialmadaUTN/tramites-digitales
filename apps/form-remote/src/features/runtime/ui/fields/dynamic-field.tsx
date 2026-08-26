import { Controller } from 'react-hook-form';
import type { FormField } from '@tramites/form-contracts';
import { isFieldEnabled, isFieldIncluded, isFieldReadOnly, isFieldRequired, isFieldVisible, type ExternalVariableValues } from '@tramites/form-contracts';
import type { FormValues } from '../../../../shared/types/form-values';
import { valuesByFieldId } from '../../model/field-state';
import type { FieldControlProps } from './types';
import { getFieldRenderer } from './registry';

type DynamicFieldProps = Omit<FieldControlProps, 'enabled' | 'options'> & {
  values: FormValues;
  errors: Record<string, { message?: string } | undefined>;
  fieldMap: Map<string, FormField>;
  externalVariables?: ExternalVariableValues;
  ancestorEnabled?: boolean;
  ancestorIncluded?: boolean;
  uploadFile?: (fieldName: string, file: File) => Promise<import('@tramites/form-contracts').UploadReference>;
};

export function DynamicField({ field, control, values, errors, fieldMap, externalVariables = {}, ancestorEnabled = true, ancestorIncluded = true, uploadFile }: DynamicFieldProps) {
  const byId = valuesByFieldId(fieldMap, values);
  if (!isFieldVisible(field, byId, externalVariables)) return null;
  const enabled = ancestorEnabled && isFieldEnabled(field, byId, externalVariables);
  // Obligatoriedad **efectiva**, no declarada: un campo deshabilitado o excluido
  // no lo exige el servidor, así que marcarlo con el asterisco sería prometer una
  // validación que no va a ocurrir. Es el mismo criterio que arma
  // `validateSubmission`, y por eso la marca coincide siempre con lo exigido.
  const required = enabled && ancestorIncluded && isFieldIncluded(field, byId, externalVariables) && isFieldRequired(field, byId, externalVariables);
  const error = errors[field.fieldName]?.message;
  const options = field.options ?? [];
  const renderField = getFieldRenderer(field.type);

  const readOnly = isFieldReadOnly(field);

  return (
    <div className={`field field-${field.width ?? 'full'}`} aria-readonly={readOnly || undefined}>
      <label htmlFor={field.id}>
        {field.label}
        {required && <span className="required"> *</span>}
        {readOnly && <span className="read-only-tag"> (solo lectura)</span>}
      </label>
      {field.helpText && <small>{field.helpText}</small>}
      <Controller
        name={field.fieldName}
        control={control}
        defaultValue={field.defaultValue}
        render={({ field: controllerField, fieldState }) => (
          <>
            {renderField({ field, controllerField, enabled, options, uploadFile })}
            {(fieldState.error?.message || error) && (
              <span className="field-error">{fieldState.error?.message || error}</span>
            )}
          </>
        )}
      />
    </div>
  );
}
