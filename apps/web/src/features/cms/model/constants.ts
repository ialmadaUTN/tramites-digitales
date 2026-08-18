import type { FieldType, FormDefinition } from '@tramites/form-contracts';

export const FIELD_TYPES: FieldType[] = [
  'text',
  'email',
  'phone',
  'alphabetic',
  'alphanumeric',
  'textarea',
  'number',
  'date',
  'time',
  'checkbox',
  'radio',
  'select',
  'combobox',
  'multiselect',
  'fileUpload',
];

export const OPTION_FIELD_TYPES: FieldType[] = ['select', 'radio', 'combobox', 'multiselect'];

export const REPEATER_FIELD_TYPES: FieldType[] = [
  'text',
  'email',
  'phone',
  'alphabetic',
  'alphanumeric',
  'number',
  'date',
  'time',
  'checkbox',
  'radio',
  'select',
  'combobox',
];

export const INITIAL_DEFINITION: FormDefinition = {
  schemaVersion: 2,
  tipificationKey: 'generic@v1',
  title: 'Nuevo formulario',
  description: 'Descripción del trámite',
  submitLabel: 'Enviar',
  containers: [
    {
      id: 'container-1',
      title: 'Datos principales',
      columns: 1,
      fields: [{ id: 'field-1', fieldName: 'name', type: 'text', label: 'Nombre', width: 'full', rules: {} }],
    },
  ],
};
