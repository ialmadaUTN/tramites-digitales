import type { AllowedMimeType, ConditionOperator, FieldType, FormDefinition, MaskKind } from '@tramites/form-contracts';
import {
  CATALOG_FIELD_TYPES,
  MASKABLE_FIELD_TYPES,
  READ_ONLY_UNSUPPORTED_FIELD_TYPES,
  REPEATER_FIELD_TYPES,
  TEXT_LENGTH_FIELD_TYPES,
} from '@tramites/form-contracts/field-rules';

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

/**
 * El editor reutiliza las listas del contrato para no divergir de lo que el
 * BFF acepta al guardar.
 */
export const OPTION_FIELD_TYPES = CATALOG_FIELD_TYPES;
export const MASK_FIELD_TYPES = MASKABLE_FIELD_TYPES;
export const LENGTH_RULE_FIELD_TYPES = TEXT_LENGTH_FIELD_TYPES;
export const READ_ONLY_BLOCKED_FIELD_TYPES = READ_ONLY_UNSUPPORTED_FIELD_TYPES;
export { REPEATER_FIELD_TYPES };

export const MASK_OPTIONS: { value: MaskKind; label: string }[] = [
  { value: 'phone_ar', label: 'Teléfono argentino' },
  { value: 'dni_ar', label: 'DNI' },
  { value: 'cuit_ar', label: 'CUIT' },
  { value: 'cbu', label: 'CBU' },
];

export const FILE_TYPE_OPTIONS: { value: AllowedMimeType; label: string }[] = [
  { value: 'application/pdf', label: 'PDF' },
  { value: 'image/jpeg', label: 'JPG' },
  { value: 'image/png', label: 'PNG' },
];

export const CONDITION_OPERATORS: { value: ConditionOperator; label: string; valueKind: 'none' | 'single' | 'list' }[] = [
  { value: 'equals', label: 'es igual a', valueKind: 'single' },
  { value: 'notEquals', label: 'es distinto de', valueKind: 'single' },
  { value: 'in', label: 'está incluido en', valueKind: 'list' },
  { value: 'notIn', label: 'no está incluido en', valueKind: 'list' },
  { value: 'greaterThan', label: 'es mayor que', valueKind: 'single' },
  { value: 'greaterThanOrEqual', label: 'es mayor o igual que', valueKind: 'single' },
  { value: 'lessThan', label: 'es menor que', valueKind: 'single' },
  { value: 'lessThanOrEqual', label: 'es menor o igual que', valueKind: 'single' },
  { value: 'empty', label: 'está vacío', valueKind: 'none' },
  { value: 'notEmpty', label: 'no está vacío', valueKind: 'none' },
];

export const INITIAL_DEFINITION: FormDefinition = {
  schemaVersion: 3,
  tipificationKey: 'generic@v1',
  externalVariables: [],
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
