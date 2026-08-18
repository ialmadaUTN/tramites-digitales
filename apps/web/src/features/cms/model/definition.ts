import type { ConditionGroup, FieldType, FormContainer, FormDefinition, FormField, FormOption } from '@tramites/form-contracts';
import { OPTION_FIELD_TYPES } from './constants';
import { createId } from './ids';

export type ConditionKey = 'visible' | 'enabled' | 'required';

function moveItem<T>(items: T[], index: number, offset: -1 | 1): T[] | null {
  const target = index + offset;
  if (index < 0 || target < 0 || target >= items.length) return null;
  const current = items[index];
  const swap = items[target];
  if (!current || !swap) return null;
  const next = [...items];
  next[index] = swap;
  next[target] = current;
  return next;
}

export function updateContainer(
  definition: FormDefinition,
  containerId: string,
  update: (container: FormContainer) => FormContainer,
): FormDefinition {
  return {
    ...definition,
    containers: definition.containers.map((container) => (container.id === containerId ? update(container) : container)),
  };
}

export function updateField(definition: FormDefinition, fieldId: string, update: (field: FormField) => FormField): FormDefinition {
  return {
    ...definition,
    containers: definition.containers.map((container) => ({
      ...container,
      fields: container.fields.map((field) => (field.id === fieldId ? update(field) : field)),
    })),
  };
}

export function moveContainer(definition: FormDefinition, containerId: string, offset: -1 | 1): FormDefinition {
  const index = definition.containers.findIndex((container) => container.id === containerId);
  const containers = moveItem(definition.containers, index, offset);
  return containers ? { ...definition, containers } : definition;
}

export function moveField(definition: FormDefinition, fieldId: string, offset: -1 | 1): FormDefinition {
  return {
    ...definition,
    containers: definition.containers.map((container) => {
      const index = container.fields.findIndex((field) => field.id === fieldId);
      const fields = moveItem(container.fields, index, offset);
      return fields ? { ...container, fields } : container;
    }),
  };
}

export function createField(index: number): FormField {
  return {
    id: createId('field'),
    fieldName: `field${index}`,
    type: 'text',
    label: 'Nuevo campo',
    width: 'full',
    rules: {},
  };
}

export function addContainer(definition: FormDefinition): FormDefinition {
  return {
    ...definition,
    containers: [...definition.containers, { id: createId('container'), title: 'Nuevo contenedor', columns: 1, fields: [] }],
  };
}

export function removeContainer(definition: FormDefinition, containerId: string): FormDefinition {
  return { ...definition, containers: definition.containers.filter((container) => container.id !== containerId) };
}

export function addField(definition: FormDefinition, containerId: string): FormDefinition {
  return updateContainer(definition, containerId, (container) => ({
    ...container,
    fields: [...container.fields, createField(container.fields.length + 1)],
  }));
}

export function removeField(definition: FormDefinition, fieldId: string): FormDefinition {
  return {
    ...definition,
    containers: definition.containers.map((container) => ({
      ...container,
      fields: container.fields.filter((field) => field.id !== fieldId),
    })),
  };
}

export function hasOptions(type: FieldType): boolean {
  return OPTION_FIELD_TYPES.includes(type);
}

export function changeFieldType(field: FormField, type: FieldType): FormField {
  return {
    ...field,
    type,
    options: hasOptions(type) ? field.options ?? [{ label: 'Opción', value: 'option' }] : field.options,
  };
}

export function parseDefaultValue(type: FieldType, raw: string): string | number | boolean | undefined {
  if (raw === '') return undefined;
  if (type === 'number') return Number(raw);
  if (type === 'checkbox') return raw === 'true';
  return raw;
}

export function slugifyOptionValue(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function addOption(options: FormOption[] | undefined, defaultLabel?: string, defaultValue?: string): FormOption[] {
  const current = options ?? [];
  const nextIndex = current.length + 1;
  const label = defaultLabel ?? `Opción ${nextIndex}`;
  const value = defaultValue ?? (defaultLabel ? slugifyOptionValue(defaultLabel) || `opcion_${nextIndex}` : `opcion_${nextIndex}`);
  return [...current, { label, value }];
}

export function updateOption(options: FormOption[] | undefined, index: number, patch: Partial<FormOption>): FormOption[] {
  const current = options ?? [];
  if (index < 0 || index >= current.length) return current;
  return current.map((opt, i) => (i === index ? { ...opt, ...patch } : opt));
}

export function removeOption(options: FormOption[] | undefined, index: number): FormOption[] {
  const current = options ?? [];
  return current.filter((_, i) => i !== index);
}

export function moveOption(options: FormOption[] | undefined, index: number, offset: -1 | 1): FormOption[] {
  const current = options ?? [];
  const moved = moveItem(current, index, offset);
  return moved ?? current;
}

export function serializeOptions(options: FormOption[] | undefined): string {
  return (options ?? []).map((option) => `${option.value}|${option.label}`).join('\n');
}

export function parseOptions(text: string): FormOption[] {
  return text.split('\n').filter(Boolean).map((line) => {
    const [value, ...labelParts] = line.split('|');
    return { value: value ?? '', label: labelParts.join('|') || value || '' };
  });
}

export function otherFields(definition: FormDefinition, fieldId: string): FormField[] {
  return definition.containers.flatMap((container) => container.fields).filter((field) => field.id !== fieldId);
}

export function toggleFieldCondition(field: FormField, key: ConditionKey, enabled: boolean, fallbackFieldId: string): FormField {
  const conditions = { ...(field.conditions ?? {}) };
  if (enabled) {
    conditions[key] = { logic: 'all', rules: [{ fieldId: fallbackFieldId, operator: 'equals', value: '' }] };
  } else {
    delete conditions[key];
  }
  return { ...field, conditions: Object.keys(conditions).length ? conditions : undefined };
}

export function setFieldCondition(field: FormField, key: ConditionKey, value: ConditionGroup): FormField {
  return { ...field, conditions: { ...(field.conditions ?? {}), [key]: value } };
}

export function setFieldRule(field: FormField, key: keyof FormField['rules'], value: unknown): FormField {
  return { ...field, rules: { ...field.rules, [key]: value } };
}

export function setFieldErrorMessage(
  field: FormField,
  key: keyof NonNullable<FormField['rules']['errorMessages']>,
  value: string,
): FormField {
  return {
    ...field,
    rules: { ...field.rules, errorMessages: { ...field.rules.errorMessages, [key]: value } },
  };
}
