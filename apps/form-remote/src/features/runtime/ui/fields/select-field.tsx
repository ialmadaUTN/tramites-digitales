import { valuesEqual } from '@tramites/form-contracts';
import { commonInputProps } from './common-props';
import type { FieldRenderer } from './types';

export const renderSelectField: FieldRenderer = (props) => {
  const { onChange, ...inputProps } = commonInputProps(props);
  const selected = props.options.find((option) => valuesEqual(props.controllerField.value, option.value));
  return (
    <select
      {...inputProps}
      value={selected === undefined ? '' : String(selected.value)}
      onChange={(event) => {
        const next = props.options.find((option) => String(option.value) === event.target.value);
        onChange(next ? next.value : event.target.value);
      }}
    >
      <option value="">Seleccioná una opción</option>
      {props.options.map((option) => (
        <option key={String(option.value)} value={String(option.value)}>
          {option.label}
        </option>
      ))}
    </select>
  );
};
