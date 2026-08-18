import type { FieldType, FormDefinition } from '@tramites/form-contracts';

export const FIELD_TYPES: FieldType[] = [
  'text',
  'textarea',
  'number',
  'date',
  'time',
  'checkbox',
  'radio',
  'select',
  'combobox',
];

export const OPTION_FIELD_TYPES: FieldType[] = ['select', 'radio', 'combobox'];

export const INITIAL_DEFINITION: FormDefinition = {
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
