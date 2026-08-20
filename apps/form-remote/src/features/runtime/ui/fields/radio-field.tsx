import { valuesEqual } from '@tramites/form-contracts';
import { isInteractive } from './common-props';
import type { FieldRenderer } from './types';

export const renderRadioField: FieldRenderer = (props) => {
  const { controllerField, options } = props;
  const interactive = isInteractive(props);
  return (
    <div className="radio-group">
      {options.map((option) => (
        <label className="radio-option" key={String(option.value)}>
          <input
            type="radio"
            name={controllerField.name}
            value={String(option.value)}
            checked={valuesEqual(controllerField.value, option.value)}
            disabled={!interactive}
            onChange={() => controllerField.onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </div>
  );
};
