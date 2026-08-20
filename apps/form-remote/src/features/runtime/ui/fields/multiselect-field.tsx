import { valuesEqual } from '@tramites/form-contracts';
import { isInteractive } from './common-props';
import type { FieldRenderer } from './types';

export const renderMultiselectField: FieldRenderer = (props) => {
  const { field, controllerField, options } = props;
  const interactive = isInteractive(props);
  const selected = Array.isArray(controllerField.value) ? controllerField.value : [];
  return (
    <div className="multi-select-group" role="group" aria-label={field.label}>
      {options.map((option, index) => {
        const id = `${field.id}-${index}`;
        return (
          <label className="multi-select-option" key={String(option.value)} htmlFor={id}>
            <input
              id={id}
              type="checkbox"
              checked={selected.some((value) => valuesEqual(value, option.value))}
              disabled={!interactive}
              onChange={(event) => {
                const next = event.target.checked
                  ? [...selected, option.value]
                  : selected.filter((value) => !valuesEqual(value, option.value));
                controllerField.onChange(next);
              }}
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
};
