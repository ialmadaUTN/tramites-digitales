import { commonInputProps } from './common-props';
import type { FieldRenderer } from './types';
import { normalizeMaskedValue, normalizePhoneValue } from '@tramites/form-contracts/validation';

function formatMaskedValue(value: string, maskKind: string | undefined): string {
  const digits = value.replace(/\D/g, '');
  switch (maskKind) {
    case 'dni_ar':
      return digits.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    case 'cuit_ar':
      return [digits.slice(0, 2), digits.slice(2, 10), digits.slice(10, 11)].filter(Boolean).join('-');
    case 'phone_ar':
      return [digits.slice(0, 2), digits.slice(2, 6), digits.slice(6, 10)].filter(Boolean).join(' ');
    case 'cbu':
      return digits;
    default:
      return value;
  }
}

export const renderTextField: FieldRenderer = (props) => {
  const baseProps = commonInputProps(props);
  const rawValue = typeof props.controllerField.value === 'string' ? props.controllerField.value : '';
  const inputType = props.field.type === 'email' ? 'email' : props.field.type === 'phone' ? 'tel' : 'text';
  const inputMode = props.field.type === 'phone' || Boolean(props.field.maskKind)
    ? 'numeric'
    : props.field.type === 'email'
      ? 'email'
      : 'text';
  return (
    <input
      {...baseProps}
      type={inputType}
      inputMode={inputMode}
      value={formatMaskedValue(rawValue, props.field.maskKind)}
      onChange={(event) => props.controllerField.onChange(
        props.field.type === 'phone'
          ? normalizePhoneValue(event.target.value)
          : normalizeMaskedValue(event.target.value, props.field.maskKind),
      )}
    />
  );
};
