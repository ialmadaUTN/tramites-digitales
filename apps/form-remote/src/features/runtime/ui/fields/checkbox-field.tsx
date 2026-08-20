import { commonInputProps } from './common-props';
import type { FieldRenderer } from './types';

export const renderCheckboxField: FieldRenderer = (props) => {
  const { readOnly, disabled, ...inputProps } = commonInputProps(props);
  return (
    <input
      {...inputProps}
      type="checkbox"
      disabled={disabled || readOnly}
      checked={Boolean(props.controllerField.value)}
      onChange={(event) => props.controllerField.onChange(event.target.checked)}
    />
  );
};
