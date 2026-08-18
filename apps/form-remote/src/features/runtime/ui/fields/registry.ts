import type { FieldType } from '@tramites/form-contracts';
import { renderCheckboxField } from './checkbox-field';
import { renderComboboxField } from './combobox-field';
import { renderDateField } from './date-field';
import { renderNumberField } from './number-field';
import { renderRadioField } from './radio-field';
import { renderSelectField } from './select-field';
import { renderTextField } from './text-field';
import { renderTextareaField } from './textarea-field';
import { renderTimeField } from './time-field';
import type { FieldRenderer } from './types';

const fieldRenderers: Record<FieldType, FieldRenderer> = {
  text: renderTextField,
  textarea: renderTextareaField,
  number: renderNumberField,
  date: renderDateField,
  time: renderTimeField,
  checkbox: renderCheckboxField,
  radio: renderRadioField,
  select: renderSelectField,
  combobox: renderComboboxField,
};

export function getFieldRenderer(type: FieldType): FieldRenderer {
  return fieldRenderers[type] ?? renderTextField;
}
