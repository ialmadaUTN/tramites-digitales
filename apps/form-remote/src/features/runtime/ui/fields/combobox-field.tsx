import { commonInputProps } from './common-props';
import type { FieldRenderer } from './types';

export const renderComboboxField: FieldRenderer = (props) => (
  <>
    <input {...commonInputProps(props)} list={`${props.field.id}-options`} />
    <datalist id={`${props.field.id}-options`}>
      {props.options.map((option) => (
        <option key={String(option.value)} value={String(option.value)}>
          {option.label}
        </option>
      ))}
    </datalist>
  </>
);
