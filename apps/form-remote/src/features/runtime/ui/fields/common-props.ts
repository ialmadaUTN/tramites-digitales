import type { FieldInputProps } from './types';

function toInputValue(value: unknown): string | number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value === undefined || value === null) return '';
  return String(value);
}

export function commonInputProps({ field, controllerField, enabled }: FieldInputProps): {
  id: string;
  disabled: boolean;
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
    placeholder: field.placeholder,
    value: toInputValue(controllerField.value),
    min: field.rules.min,
    max: field.rules.max,
    onBlur: controllerField.onBlur,
    onChange: controllerField.onChange,
    ref: controllerField.ref,
  };
}
