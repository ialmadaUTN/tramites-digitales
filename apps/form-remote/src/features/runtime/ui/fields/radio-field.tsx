import { valuesEqual } from '@tramites/form-contracts';
import type { FieldRenderer } from './types';

export const renderRadioField: FieldRenderer = ({ controllerField, enabled, options }) => (
  <div className="radio-group">
    {options.map((option) => (
      <label className="radio-option" key={String(option.value)}>
        <input
          type="radio"
          name={controllerField.name}
          value={String(option.value)}
          checked={valuesEqual(controllerField.value, option.value)}
          disabled={!enabled}
          onChange={() => controllerField.onChange(option.value)}
        />
        {option.label}
      </label>
    ))}
  </div>
);
