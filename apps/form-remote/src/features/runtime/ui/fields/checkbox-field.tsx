import { commonInputProps } from './common-props';
import type { FieldRenderer } from './types';

export const renderCheckboxField: FieldRenderer = (props) => (
  <input
    {...commonInputProps(props)}
    type="checkbox"
    checked={Boolean(props.controllerField.value)}
    onChange={(event) => props.controllerField.onChange(event.target.checked)}
  />
);
