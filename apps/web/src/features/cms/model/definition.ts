import type { ConditionGroup, ConditionRule, FaqBlock, FieldType, FormContainer, FormDefinition, FormField, FormOption } from '@tramites/form-contracts';
import { defaultValuesOutsideCatalog, isMaskCompatible } from '@tramites/form-contracts/field-rules';
import {
  LENGTH_RULE_FIELD_TYPES,
  OPTION_FIELD_TYPES,
  READ_ONLY_BLOCKED_FIELD_TYPES,
} from './constants';
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
    containers: [...definition.containers, { id: createId('container'), title: 'Nuevo contenedor', kind: 'section', columns: 1, fields: [] }],
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

export function createFaqBlock(index: number): FaqBlock {
  return { id: createId('faq'), question: `Pregunta ${index}`, answer: '', initiallyOpen: false };
}

export function addFaqBlock(definition: FormDefinition): FormDefinition {
  const faqBlocks = definition.faqBlocks ?? [];
  return { ...definition, faqBlocks: [...faqBlocks, createFaqBlock(faqBlocks.length + 1)] };
}

export function removeFaqBlock(definition: FormDefinition, blockId: string): FormDefinition {
  return { ...definition, faqBlocks: (definition.faqBlocks ?? []).filter((block) => block.id !== blockId) };
}

export function moveFaqBlock(definition: FormDefinition, blockId: string, offset: -1 | 1): FormDefinition {
  const faqBlocks = definition.faqBlocks ?? [];
  const index = faqBlocks.findIndex((block) => block.id === blockId);
  const moved = moveItem(faqBlocks, index, offset);
  return moved ? { ...definition, faqBlocks: moved } : definition;
}

export function updateFaqBlock(definition: FormDefinition, blockId: string, update: (block: FaqBlock) => FaqBlock): FormDefinition {
  return {
    ...definition,
    faqBlocks: (definition.faqBlocks ?? []).map((block) => (block.id === blockId ? update(block) : block)),
  };
}

export function hasOptions(type: FieldType): boolean {
  return OPTION_FIELD_TYPES.includes(type);
}

function dropErrorMessages(rules: FormField['rules'], keys: (keyof NonNullable<FormField['rules']['errorMessages']>)[]) {
  if (!rules.errorMessages) return;
  const messages = { ...rules.errorMessages };
  for (const key of keys) delete messages[key];
  if (Object.keys(messages).length) rules.errorMessages = messages;
  else delete rules.errorMessages;
}

/** Conserva el valor por defecto solo cuando sigue siendo representable en el nuevo tipo. */
function defaultValueForType(current: FormField['defaultValue'], type: FieldType): FormField['defaultValue'] {
  if (current === undefined) return undefined;
  if (type === 'multiselect') return Array.isArray(current) ? current : undefined;
  if (Array.isArray(current) || type === 'fileUpload') return undefined;
  if (type === 'number') return typeof current === 'number' && Number.isFinite(current) ? current : undefined;
  if (type === 'checkbox') return typeof current === 'boolean' ? current : undefined;
  return typeof current === 'boolean' ? undefined : current;
}

/**
 * Descarta la configuración que el nuevo tipo no admite, para que el editor no
 * arrastre reglas incompatibles que el contrato rechaza al guardar.
 */
export function changeFieldType(field: FormField, type: FieldType): FormField {
  const rules: FormField['rules'] = { ...field.rules };
  if (!LENGTH_RULE_FIELD_TYPES.includes(type)) {
    delete rules.minLength;
    delete rules.maxLength;
    dropErrorMessages(rules, ['minLength', 'maxLength']);
  }
  if (type !== 'number') {
    delete rules.min;
    delete rules.max;
    dropErrorMessages(rules, ['min', 'max']);
  }

  const next: FormField = {
    ...field,
    type,
    rules,
    defaultValue: defaultValueForType(field.defaultValue, type),
    options: hasOptions(type) ? field.options ?? [{ label: 'Opción', value: 'option' }] : undefined,
  };
  if (type === 'combobox') next.allowCustomValue = field.allowCustomValue ?? false;
  else delete next.allowCustomValue;
  if (!next.maskKind || !isMaskCompatible(type, next.maskKind)) delete next.maskKind;
  if (READ_ONLY_BLOCKED_FIELD_TYPES.includes(type)) delete next.readOnly;
  if (type !== 'fileUpload') {
    delete next.minFiles;
    delete next.maxFiles;
    delete next.allowedMimeTypes;
  }
  // Un valor por defecto heredado de otro tipo no pertenece al catálogo nuevo:
  // dejarlo produciría un campo que el contrato rechaza al guardar.
  if (defaultValuesOutsideCatalog(next).length > 0) delete next.defaultValue;
  if (next.defaultValue === undefined) delete next.defaultValue;
  if (next.options === undefined) delete next.options;
  return next;
}

export function parseDefaultValue(type: FieldType, raw: string): string | number | boolean | string[] | undefined {
  if (raw === '') return undefined;
  if (type === 'number') return Number(raw);
  if (type === 'checkbox') return raw === 'true';
  if (type === 'multiselect') return raw.split(',').map((value) => value.trim()).filter(Boolean);
  return raw;
}

/** Alterna un valor del catálogo dentro del `defaultValue` de un multiselect. */
export function toggleDefaultOption(
  current: FormField['defaultValue'],
  value: string | number,
  checked: boolean,
): FormField['defaultValue'] {
  const list = Array.isArray(current) ? current : [];
  const without = list.filter((item) => String(item) !== String(value));
  const next = checked ? [...without, value] : without;
  return next.length ? next : undefined;
}

export function setFieldDefaultValue(field: FormField, value: FormField['defaultValue']): FormField {
  const next = { ...field };
  if (value === undefined) delete next.defaultValue;
  else next.defaultValue = value;
  return next;
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

/**
 * Candidatos válidos para una condición. Las celdas de grilla quedan fuera:
 * el contrato no permite referenciarlas y guardarlas haría fallar el BFF.
 */
export function otherFields(definition: FormDefinition, fieldId: string): FormField[] {
  return definition.containers
    .filter((container) => container.kind !== 'repeater')
    .flatMap((container) => container.fields)
    .filter((field) => field.id !== fieldId);
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

export function setConditionLogic(condition: ConditionGroup, logic: ConditionGroup['logic']): ConditionGroup {
  return { ...condition, logic };
}

export function addConditionRule(condition: ConditionGroup, fallbackFieldId: string): ConditionGroup {
  return { ...condition, rules: [...condition.rules, { fieldId: fallbackFieldId, operator: 'equals', value: '' }] };
}

export function updateConditionRule(
  condition: ConditionGroup,
  index: number,
  patch: Partial<ConditionRule>,
): ConditionGroup {
  return { ...condition, rules: condition.rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)) };
}

/** El contrato exige al menos una regla, así que la última no se puede quitar. */
export function removeConditionRule(condition: ConditionGroup, index: number): ConditionGroup {
  if (condition.rules.length <= 1) return condition;
  return { ...condition, rules: condition.rules.filter((_, i) => i !== index) };
}

export function setFieldReadOnly(field: FormField, readOnly: boolean): FormField {
  const next = { ...field };
  if (readOnly) next.readOnly = true;
  else delete next.readOnly;
  return next;
}

/** `undefined` borra la regla en vez de dejar la clave presente sin valor. */
export function setFieldRule(field: FormField, key: keyof FormField['rules'], value: unknown): FormField {
  const rules = { ...field.rules };
  if (value === undefined || value === false || value === '') delete rules[key];
  else Object.assign(rules, { [key]: value });
  return { ...field, rules };
}

export function setFieldErrorMessage(
  field: FormField,
  key: keyof NonNullable<FormField['rules']['errorMessages']>,
  value: string,
): FormField {
  const messages = { ...field.rules.errorMessages };
  if (value.trim()) messages[key] = value;
  else delete messages[key];
  const rules = { ...field.rules };
  if (Object.keys(messages).length) rules.errorMessages = messages;
  else delete rules.errorMessages;
  return { ...field, rules };
}
