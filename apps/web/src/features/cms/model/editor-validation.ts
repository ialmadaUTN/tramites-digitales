import type { FormDefinition } from '@tramites/form-contracts';
import { fieldNameError } from '@tramites/form-contracts/field-name';
import { OPTION_FIELD_TYPES } from './constants';

export type FieldEditorErrors = {
  fieldName?: string;
  label?: string;
  options?: string;
};

export type DefinitionEditorErrors = {
  name?: string;
  title?: string;
  submitLabel?: string;
  containers: Record<string, { title?: string }>;
  fields: Record<string, FieldEditorErrors>;
  hasErrors: boolean;
};

export function collectDefinitionEditorErrors(definition: FormDefinition, name?: string): DefinitionEditorErrors {
  const containers: Record<string, { title?: string }> = {};
  const fields: Record<string, FieldEditorErrors> = {};
  const seenNames = new Map<string, string>();

  const nameError = name !== undefined && !name.trim() ? 'El nombre interno es obligatorio' : undefined;
  const titleError = !definition.title.trim() ? 'El título es obligatorio' : undefined;
  const submitLabelError = !definition.submitLabel.trim() ? 'La etiqueta del botón es obligatoria' : undefined;

  for (const container of definition.containers) {
    if (!container.title.trim()) containers[container.id] = { title: 'El título del contenedor es obligatorio' };

    for (const field of container.fields) {
      const fieldErrors: FieldEditorErrors = {};
      const identifierError = fieldNameError(field.fieldName);
      if (identifierError) fieldErrors.fieldName = identifierError;
      if (!field.label.trim()) fieldErrors.label = 'La etiqueta es obligatoria';
      if (OPTION_FIELD_TYPES.includes(field.type) && (!field.options || field.options.length === 0)) {
        fieldErrors.options = 'Este tipo de campo necesita al menos una opción';
      }

      const previousId = seenNames.get(field.fieldName);
      if (previousId && !identifierError) {
        const duplicate = `Este nombre de clave ya se usa en otro campo`;
        fieldErrors.fieldName = duplicate;
        fields[previousId] = { ...fields[previousId], fieldName: duplicate };
      } else if (!identifierError) {
        seenNames.set(field.fieldName, field.id);
      }

      if (Object.keys(fieldErrors).length > 0) fields[field.id] = { ...fields[field.id], ...fieldErrors };
    }
  }

  return {
    name: nameError,
    title: titleError,
    submitLabel: submitLabelError,
    containers,
    fields,
    hasErrors: Boolean(nameError || titleError || submitLabelError || Object.keys(containers).length || Object.keys(fields).length),
  };
}
