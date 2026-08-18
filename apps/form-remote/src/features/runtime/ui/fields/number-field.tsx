import { commonInputProps } from './common-props';
import type { FieldRenderer } from './types';

export const renderNumberField: FieldRenderer = (props) => (
  <input
    {...commonInputProps(props)}
    type="number"
    onChange={(event) => props.controllerField.onChange(event.target.value === '' ? undefined : Number(event.target.value))}
  />
);
