import { isFieldReadOnly } from '@tramites/form-contracts';
import type { FieldInputProps } from './types';

function toInputValue(value: unknown): string | number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value === undefined || value === null) return '';
  return String(value);
}

/**
 * Los controles que no soportan el atributo `readOnly` del DOM (select,
 * checkbox, radio, multiselect) se bloquean con `disabled`; el valor sigue
 * viviendo en el estado del formulario, así que igual viaja en el submit.
 */
export function isInteractive({ field, enabled }: Pick<FieldInputProps, 'field' | 'enabled'>): boolean {
  return enabled && !isFieldReadOnly(field);
}

export function commonInputProps({ field, controllerField, enabled }: FieldInputProps): {
  id: string;
  disabled: boolean;
  readOnly: boolean;
  placeholder: string | undefined;
  value: string | number;
  min?: number;
  max?: number;
  onBlur: FieldInputProps['controllerField']['onBlur'];
  onChange: FieldInputProps['controllerField']['onChange'];
  ref: FieldInputProps['controllerField']['ref'];
} {
  return {
    id: field.id,
    disabled: !enabled,
    readOnly: isFieldReadOnly(field),
    placeholder: field.placeholder,
    value: toInputValue(controllerField.value),
    min: field.rules.min,
    max: field.rules.max,
    onBlur: controllerField.onBlur,
    onChange: controllerField.onChange,
    ref: controllerField.ref,
  };
}
