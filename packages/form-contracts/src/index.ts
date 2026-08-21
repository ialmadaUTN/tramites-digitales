import { z } from 'zod';
export type { Database, Json } from './database.types.js';
export { FIELD_NAME_INVALID_MESSAGE, FIELD_NAME_PATTERN, fieldNameError } from './field-name.js';
import { FIELD_NAME_INVALID_MESSAGE, FIELD_NAME_PATTERN } from './field-name.js';
export {
  EMPTY_CONTAINER_MESSAGE,
  EMPTY_FORM_MESSAGE,
  EMPTY_REPEATER_MESSAGE,
  isPublishable,
  structuralIssues,
  type StructuralIssue,
} from './structural-validation.js';
import { structuralIssues } from './structural-validation.js';

export const fieldTypeSchema = z.enum([
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
]);
export type FieldType = z.infer<typeof fieldTypeSchema>;

export const maskKindSchema = z.enum(['phone_ar', 'dni_ar', 'cuit_ar', 'cbu']);
export type MaskKind = z.infer<typeof maskKindSchema>;

export const allowedMimeTypeSchema = z.enum(['application/pdf', 'image/jpeg', 'image/png']);
export type AllowedMimeType = z.infer<typeof allowedMimeTypeSchema>;

export * from './field-rules.js';
import {
  CATALOG_FIELD_TYPES,
  defaultValuesOutsideCatalog,
  duplicateOptionValues,
  isMaskCompatible,
  isValidRegexPattern,
  MULTI_VALUE_FIELD_TYPES,
  READ_ONLY_UNSUPPORTED_FIELD_TYPES,
  REPEATER_FIELD_TYPES,
  TEXT_LENGTH_FIELD_TYPES,
} from './field-rules.js';

export const fieldNameSchema = z
  .string()
  .min(1, 'El nombre de clave es obligatorio')
  .regex(FIELD_NAME_PATTERN, FIELD_NAME_INVALID_MESSAGE);

export const optionSchema = z.object({
  label: z.string().trim().min(1, 'La etiqueta de la opción es obligatoria'),
  value: z.union([z.string().trim().min(1, 'El valor de la opción es obligatorio'), z.number()]),
});
export type FormOption = z.infer<typeof optionSchema>;

export const scalarValueSchema = z.union([z.string(), z.number(), z.boolean()]);
export type ScalarValue = z.infer<typeof scalarValueSchema>;

export const uploadReferenceSchema = z.object({
  uploadId: z.string().uuid(),
  name: z.string().min(1).max(255),
  contentType: allowedMimeTypeSchema,
  size: z.number().int().positive().max(10 * 1024 * 1024),
});
export type UploadReference = z.infer<typeof uploadReferenceSchema>;

export const formValueSchema = z.union([
  scalarValueSchema,
  z.array(scalarValueSchema),
  z.array(uploadReferenceSchema),
  z.array(z.record(z.string(), scalarValueSchema)),
]);
export type RepeaterRow = Record<string, ScalarValue>;
export type FormValue = ScalarValue | ScalarValue[] | UploadReference[] | RepeaterRow[];

export const conditionOperatorSchema = z.enum([
  'equals',
  'notEquals',
  'in',
  'notIn',
  'greaterThan',
  'greaterThanOrEqual',
  'lessThan',
  'lessThanOrEqual',
  'empty',
  'notEmpty',
]);
export type ConditionOperator = z.infer<typeof conditionOperatorSchema>;

export const conditionRuleSchema = z.object({
  fieldId: z.string().min(1),
  operator: conditionOperatorSchema,
  value: z.unknown().optional(),
});

export type ConditionRule = z.infer<typeof conditionRuleSchema>;

export const conditionGroupSchema = z.object({
  logic: z.enum(['all', 'any']),
  rules: z.array(conditionRuleSchema).min(1),
});
export type ConditionGroup = z.infer<typeof conditionGroupSchema>;

export const fieldRulesSchema = z.object({
  required: z.boolean().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  minLength: z.number().int().nonnegative().optional(),
  maxLength: z.number().int().nonnegative().optional(),
  pattern: z.string().optional(),
  errorMessages: z
    .object({
      required: z.string().optional(),
      min: z.string().optional(),
      max: z.string().optional(),
      minLength: z.string().optional(),
      maxLength: z.string().optional(),
      pattern: z.string().optional(),
      type: z.string().optional(),
    })
    .optional(),
});
export type FieldRules = z.infer<typeof fieldRulesSchema>;

export const fieldConditionsSchema = z.object({
  visible: conditionGroupSchema.optional(),
  enabled: conditionGroupSchema.optional(),
  required: conditionGroupSchema.optional(),
});
export type FieldConditions = z.infer<typeof fieldConditionsSchema>;

const defaultValueSchema = z.union([scalarValueSchema, z.array(scalarValueSchema)]);

export const formFieldSchema = z.object({
  id: z.string().min(1),
  fieldName: fieldNameSchema,
  type: fieldTypeSchema,
  label: z.string().min(1),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  defaultValue: defaultValueSchema.optional(),
  /**
   * Campo visible pero no editable. El runtime bloquea la entrada y el
   * validador ignora lo que llegue del cliente: siempre se persiste
   * `defaultValue`, así un payload manipulado no puede sobrescribirlo.
   */
  readOnly: z.boolean().optional(),
  width: z.enum(['full', 'half']).default('full'),
  options: z.array(optionSchema).optional(),
  maskKind: maskKindSchema.optional(),
  allowCustomValue: z.boolean().optional(),
  minFiles: z.number().int().nonnegative().optional(),
  maxFiles: z.number().int().positive().max(5).optional(),
  allowedMimeTypes: z.array(allowedMimeTypeSchema).min(1).optional(),
  rules: fieldRulesSchema.default({}),
  conditions: fieldConditionsSchema.optional(),
});
export type FormField = z.infer<typeof formFieldSchema>;

export const formContainerSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: z.enum(['section', 'repeater']).optional(),
  fieldName: fieldNameSchema.optional(),
  columns: z.union([z.literal(1), z.literal(2)]).default(1),
  minRows: z.number().int().nonnegative().optional(),
  maxRows: z.number().int().positive().max(50).optional(),
  fields: z.array(formFieldSchema),
});
export type FormContainer = z.infer<typeof formContainerSchema>;

export const formDefinitionSchema = z
  .object({
    schemaVersion: z.literal(2).optional(),
    tipificationKey: z.string().trim().min(1).optional(),
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    submitLabel: z.string().min(1).max(80).default('Enviar'),
    containers: z.array(formContainerSchema),
  })
  .superRefine((definition, ctx) => {
    const isV2 = definition.schemaVersion === 2;
    const v2FieldTypes = new Set<FieldType>(['email', 'phone', 'alphabetic', 'alphanumeric', 'multiselect', 'fileUpload']);
    const repeaterFieldTypes = new Set<FieldType>(REPEATER_FIELD_TYPES);
    const fieldIds = new Set<string>();
    const allFieldIds = new Set<string>();
    const fieldNames = new Set<string>();
    const fieldsById = new Map<string, FormField>();
    if (isV2 && !definition.tipificationKey) {
      ctx.addIssue({ code: 'custom', path: ['tipificationKey'], message: 'Un formulario v2 requiere tipificationKey' });
    }
    definition.containers.forEach((container, containerIndex) => {
      const isRepeater = container.kind === 'repeater';
      if (isRepeater) {
        if (!isV2) {
          ctx.addIssue({ code: 'custom', path: ['containers', containerIndex, 'kind'], message: 'Las grillas repetibles requieren schemaVersion 2' });
        }
        if (!container.fieldName) {
          ctx.addIssue({ code: 'custom', path: ['containers', containerIndex, 'fieldName'], message: 'Una grilla repetible requiere fieldName' });
        }
        if (container.minRows !== undefined && container.maxRows !== undefined && container.minRows > container.maxRows) {
          ctx.addIssue({ code: 'custom', path: ['containers', containerIndex, 'minRows'], message: 'minRows no puede superar maxRows' });
        }
        const repeaterFieldIds = new Set<string>();
        const repeaterFieldNames = new Set<string>();
        for (const [fieldIndex, field] of container.fields.entries()) {
          const fieldPath = ['containers', containerIndex, 'fields', fieldIndex] as const;
          if (!repeaterFieldTypes.has(field.type)) {
            ctx.addIssue({ code: 'custom', path: ['containers', containerIndex, 'fields', fieldIndex, 'type'], message: `${field.type} no está permitido dentro de una grilla` });
          }
          if (field.conditions) {
            ctx.addIssue({ code: 'custom', path: ['containers', containerIndex, 'fields', fieldIndex, 'conditions'], message: 'Las celdas de una grilla no admiten condiciones' });
          }
          if (repeaterFieldIds.has(field.id) || allFieldIds.has(field.id)) {
            ctx.addIssue({ code: 'custom', path: [...fieldPath, 'id'], message: `ID de campo duplicado: ${field.id}` });
          }
          if (repeaterFieldNames.has(field.fieldName)) {
            ctx.addIssue({ code: 'custom', path: [...fieldPath, 'fieldName'], message: `fieldName duplicado en la grilla: ${field.fieldName}` });
          }
          repeaterFieldIds.add(field.id);
          repeaterFieldNames.add(field.fieldName);
          allFieldIds.add(field.id);
        }
        if (container.fieldName && fieldNames.has(container.fieldName)) {
          ctx.addIssue({ code: 'custom', path: ['containers', containerIndex, 'fieldName'], message: `fieldName duplicado: ${container.fieldName}` });
        }
        if (container.fieldName) fieldNames.add(container.fieldName);
      }
      container.fields.forEach((field, fieldIndex) => {
        const fieldPath = ['containers', containerIndex, 'fields', fieldIndex] as const;
        if (!isRepeater) {
          if (allFieldIds.has(field.id)) {
            ctx.addIssue({ code: 'custom', path: [...fieldPath, 'id'], message: `ID de campo duplicado: ${field.id}` });
          }
          if (fieldNames.has(field.fieldName)) {
            ctx.addIssue({ code: 'custom', path: [...fieldPath, 'fieldName'], message: `fieldName duplicado: ${field.fieldName}` });
          }
          fieldIds.add(field.id);
          allFieldIds.add(field.id);
          fieldNames.add(field.fieldName);
          fieldsById.set(field.id, field);
        }
        if (CATALOG_FIELD_TYPES.includes(field.type) && (!field.options || field.options.length === 0)) {
          ctx.addIssue({ code: 'custom', path: [...fieldPath, 'options'], message: `${field.type} requiere opciones` });
        }
        for (const duplicate of duplicateOptionValues(field.options)) {
          ctx.addIssue({ code: 'custom', path: [...fieldPath, 'options'], message: `Valor de opción duplicado: ${duplicate}` });
        }
        for (const outsider of defaultValuesOutsideCatalog(field)) {
          ctx.addIssue({ code: 'custom', path: [...fieldPath, 'defaultValue'], message: `El valor por defecto ${outsider} no pertenece al catálogo de opciones` });
        }
        if (Array.isArray(field.defaultValue) && !MULTI_VALUE_FIELD_TYPES.includes(field.type)) {
          ctx.addIssue({ code: 'custom', path: [...fieldPath, 'defaultValue'], message: `${field.type} no admite un valor por defecto múltiple` });
        }
        if (field.rules.pattern !== undefined && !isValidRegexPattern(field.rules.pattern)) {
          ctx.addIssue({ code: 'custom', path: [...fieldPath, 'rules', 'pattern'], message: 'La expresión regular no es válida' });
        }
        if (field.rules.minLength !== undefined && field.rules.maxLength !== undefined && field.rules.minLength > field.rules.maxLength) {
          ctx.addIssue({ code: 'custom', path: [...fieldPath, 'rules', 'minLength'], message: 'El mínimo de caracteres no puede superar el máximo' });
        }
        if (field.rules.min !== undefined && field.rules.max !== undefined && field.rules.min > field.rules.max) {
          ctx.addIssue({ code: 'custom', path: [...fieldPath, 'rules', 'min'], message: 'El mínimo numérico no puede superar el máximo' });
        }
        if ((field.rules.minLength !== undefined || field.rules.maxLength !== undefined) && !TEXT_LENGTH_FIELD_TYPES.includes(field.type)) {
          ctx.addIssue({ code: 'custom', path: [...fieldPath, 'rules', 'minLength'], message: `${field.type} no admite reglas de longitud` });
        }
        if ((field.rules.min !== undefined || field.rules.max !== undefined) && field.type !== 'number') {
          ctx.addIssue({ code: 'custom', path: [...fieldPath, 'rules', 'min'], message: `${field.type} no admite rangos numéricos` });
        }
        if (field.readOnly && READ_ONLY_UNSUPPORTED_FIELD_TYPES.includes(field.type)) {
          ctx.addIssue({ code: 'custom', path: [...fieldPath, 'readOnly'], message: `${field.type} no admite solo lectura` });
        }
        if (field.readOnly && field.rules.required && field.defaultValue === undefined) {
          ctx.addIssue({ code: 'custom', path: [...fieldPath, 'defaultValue'], message: 'Un campo obligatorio de solo lectura necesita un valor por defecto' });
        }
        if (field.readOnly && !isV2) {
          ctx.addIssue({ code: 'custom', path: [...fieldPath, 'readOnly'], message: 'Los campos de solo lectura requieren schemaVersion 2' });
        }
        if (field.type === 'combobox' && field.allowCustomValue === undefined && isV2) {
          ctx.addIssue({ code: 'custom', path: [...fieldPath, 'allowCustomValue'], message: 'Los combobox v2 deben declarar allowCustomValue' });
        }
        if (field.type !== 'combobox' && field.allowCustomValue !== undefined) {
          ctx.addIssue({ code: 'custom', path: [...fieldPath, 'allowCustomValue'], message: 'allowCustomValue solo aplica a combobox' });
        }
        if (field.type !== 'fileUpload' && (field.minFiles !== undefined || field.maxFiles !== undefined || field.allowedMimeTypes !== undefined)) {
          ctx.addIssue({ code: 'custom', path: [...fieldPath, 'minFiles'], message: 'La configuración de archivos solo aplica a fileUpload' });
        }
        if (field.type === 'fileUpload') {
          if (!isV2) ctx.addIssue({ code: 'custom', path: [...fieldPath, 'type'], message: 'fileUpload requiere schemaVersion 2' });
          if (field.minFiles !== undefined && field.maxFiles !== undefined && field.minFiles > field.maxFiles) {
            ctx.addIssue({ code: 'custom', path: [...fieldPath, 'minFiles'], message: 'minFiles no puede superar maxFiles' });
          }
        }
        if (field.maskKind && !isMaskCompatible(field.type, field.maskKind)) {
          ctx.addIssue({ code: 'custom', path: [...fieldPath, 'maskKind'], message: `${field.maskKind} no es compatible con el tipo ${field.type}` });
        }
        if (!isV2 && (v2FieldTypes.has(field.type) || field.maskKind !== undefined || field.allowCustomValue !== undefined)) {
          ctx.addIssue({ code: 'custom', path: [...fieldPath, 'type'], message: `${field.type} requiere schemaVersion 2` });
        }
        if (!isRepeater) {
          for (const [conditionKey, condition] of Object.entries(field.conditions ?? {})) {
          for (const [ruleIndex, rule] of (condition?.rules ?? []).entries()) {
            if (rule.fieldId === field.id) {
              ctx.addIssue({ code: 'custom', path: [...fieldPath, 'conditions', conditionKey, 'rules', ruleIndex, 'fieldId'], message: `La condición de ${field.id} se referencia a sí misma` });
            }
            if (!fieldIds.has(rule.fieldId) && !definition.containers.filter((candidate) => candidate.kind !== 'repeater').some((candidate) => candidate.fields.some((candidateField) => candidateField.id === rule.fieldId))) {
              ctx.addIssue({ code: 'custom', path: [...fieldPath, 'conditions', conditionKey, 'rules', ruleIndex, 'fieldId'], message: `Campo referido inexistente: ${rule.fieldId}` });
            }
          }
          }
        }
      });
    });

    const visiting = new Set<string>();
    const visited = new Set<string>();
    const reportedCycles = new Set<string>();
    const visit = (fieldId: string, path: string[]) => {
      if (visiting.has(fieldId)) {
        const cycleStart = path.indexOf(fieldId);
        const cycle = [...path.slice(cycleStart), fieldId].join(' -> ');
        if (!reportedCycles.has(cycle)) {
          reportedCycles.add(cycle);
          ctx.addIssue({ code: 'custom', path: ['containers'], message: `Dependencia circular: ${cycle}` });
        }
        return;
      }
      if (visited.has(fieldId)) return;
      const field = fieldsById.get(fieldId);
      if (!field) return;
      visiting.add(fieldId);
      const dependencies = Object.values(field.conditions ?? {}).flatMap((group) => group?.rules.map((rule) => rule.fieldId) ?? []);
      for (const dependency of dependencies) visit(dependency, [...path, fieldId]);
      visiting.delete(fieldId);
      visited.add(fieldId);
    };
    for (const fieldId of fieldsById.keys()) visit(fieldId, []);
  });
export type FormDefinition = z.infer<typeof formDefinitionSchema>;

/**
 * Definición lista para publicar: el esquema base **más** la completitud
 * estructural. Es un esquema aparte y no una regla más del base porque el base
 * también valida las lecturas; ver `structural-validation.ts`.
 *
 * Guardar un borrador usa `formDefinitionSchema`; publicar usa este.
 */
export const publishableFormDefinitionSchema = formDefinitionSchema.superRefine((definition, ctx) => {
  for (const issue of structuralIssues(definition)) {
    ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
  }
});

/**
 * Upgrades a legacy definition when it enters the CMS. Published v1 versions
 * remain untouched; the next draft save becomes an explicit v2 definition
 * without changing the behavior of existing fields.
 */
export function upgradeDefinitionToV2(definition: FormDefinition, tipificationKey = 'generic@v1'): FormDefinition {
  if (definition.schemaVersion === 2) return definition;
  return {
    ...definition,
    schemaVersion: 2,
    tipificationKey: definition.tipificationKey ?? tipificationKey,
    containers: definition.containers.map((container) => ({
      ...container,
      kind: container.kind ?? 'section',
      fields: container.fields.map((field) => (
        field.type === 'combobox' && field.allowCustomValue === undefined
          ? { ...field, allowCustomValue: true }
          : field
      )),
    })),
  };
}

export const dynamicFormPropsSchema = z.object({
  formId: z.string().uuid(),
  apiBaseUrl: z.string().url(),
  mode: z.enum(['published', 'draft']).optional(),
});
export type DynamicFormProps = z.infer<typeof dynamicFormPropsSchema> & {
  onSubmitted?: (receipt: SubmissionReceipt) => void;
  onError?: (error: FormRuntimeError) => void;
};

export const submissionEnvelopeSchema = z.object({
  submissionId: z.string().uuid(),
  formId: z.string().uuid(),
  formVersion: z.number().int().positive(),
  submittedAt: z.string().datetime(),
  data: z.record(z.string(), formValueSchema),
});
export type SubmissionEnvelope = z.infer<typeof submissionEnvelopeSchema>;

export const submissionReceiptSchema = z.object({
  submissionId: z.string().uuid(),
  formId: z.string().uuid(),
  formVersion: z.number().int().positive(),
  deliveryStatus: z.enum(['pending', 'delivered', 'failed']),
  submittedAt: z.string().datetime(),
});
export type SubmissionReceipt = z.infer<typeof submissionReceiptSchema>;

export type FormRuntimeError = {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
};

export const runtimeFormResponseSchema = z.object({
  formId: z.string().uuid(),
  version: z.number().int().positive().nullable(),
  definition: formDefinitionSchema,
  source: z.enum(['draft', 'published']),
});
export type RuntimeFormResponse = z.infer<typeof runtimeFormResponseSchema>;

export function flattenFields(definition: FormDefinition): FormField[] {
  return definition.containers
    .filter((container) => container.kind !== 'repeater')
    .flatMap((container) => container.fields);
}

export function repeaterContainers(definition: FormDefinition): FormContainer[] {
  return definition.containers.filter((container) => container.kind === 'repeater');
}

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return Array.isArray(value) && value.length === 0;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function valuesEqual(actual: unknown, expected: unknown): boolean {
  if (Object.is(actual, expected)) return true;
  if (isEmpty(actual) && isEmpty(expected)) return true;
  if (isEmpty(actual) || isEmpty(expected)) return false;

  const actualBoolean = asBoolean(actual);
  const expectedBoolean = asBoolean(expected);
  if (actualBoolean !== undefined && expectedBoolean !== undefined) return actualBoolean === expectedBoolean;

  if (typeof actual === 'number' || typeof expected === 'number') {
    const actualNumber = asFiniteNumber(actual);
    const expectedNumber = asFiniteNumber(expected);
    if (actualNumber !== undefined && expectedNumber !== undefined) return actualNumber === expectedNumber;
  }

  if (typeof actual === 'string' || typeof expected === 'string') {
    return String(actual).trim() === String(expected).trim();
  }

  if (Array.isArray(actual) && Array.isArray(expected)) {
    return actual.length === expected.length && actual.every((item, index) => valuesEqual(item, expected[index]));
  }

  return false;
}

export function evaluateCondition(group: ConditionGroup | undefined, values: Record<string, unknown>): boolean {
  if (!group) return true;
  const results = group.rules.map((rule) => {
    const actual = values[rule.fieldId];
    switch (rule.operator) {
      case 'equals': return valuesEqual(actual, rule.value);
      case 'notEquals': return !valuesEqual(actual, rule.value);
      case 'in': return Array.isArray(rule.value) && rule.value.some((item) => valuesEqual(actual, item));
      case 'notIn': return Array.isArray(rule.value) && !rule.value.some((item) => valuesEqual(actual, item));
      case 'greaterThan': return Number(actual) > Number(rule.value);
      case 'greaterThanOrEqual': return Number(actual) >= Number(rule.value);
      case 'lessThan': return Number(actual) < Number(rule.value);
      case 'lessThanOrEqual': return Number(actual) <= Number(rule.value);
      case 'empty': return isEmpty(actual);
      case 'notEmpty': return !isEmpty(actual);
    }
  });
  return group.logic === 'all' ? results.every(Boolean) : results.some(Boolean);
}

export function isFieldVisible(field: FormField, values: Record<string, unknown>): boolean {
  return evaluateCondition(field.conditions?.visible, values);
}

export function isFieldEnabled(field: FormField, values: Record<string, unknown>): boolean {
  return evaluateCondition(field.conditions?.enabled, values);
}

export function isFieldRequired(field: FormField, values: Record<string, unknown>): boolean {
  return Boolean(field.rules.required) || evaluateCondition(field.conditions?.required, values) && Boolean(field.conditions?.required);
}

export function cleanSubmissionPayload(definition: FormDefinition, payload: Record<string, unknown>): Record<string, FormValue> {
  const output: Record<string, FormValue> = {};
  const valuesById: Record<string, unknown> = {};
  for (const field of flattenFields(definition)) valuesById[field.id] = payload[field.fieldName];
  for (const field of flattenFields(definition)) {
    if (!isFieldVisible(field, valuesById) || !isFieldEnabled(field, valuesById)) continue;
    const value = payload[field.fieldName];
    if (value !== undefined && value !== null && value !== '') {
      if (isFormValue(value)) output[field.fieldName] = value;
    }
  }
  for (const container of repeaterContainers(definition)) {
    const value = container.fieldName ? payload[container.fieldName] : undefined;
    if (value !== undefined && value !== null && value !== '' && isRepeaterValue(value)) {
      output[container.fieldName!] = value;
    }
  }
  return output;
}

export function isFormValue(value: unknown): value is FormValue {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true;
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') return true;
    if (isUploadReference(item)) return true;
    return isRepeaterRow(item);
  });
}

export function isUploadReference(value: unknown): value is UploadReference {
  return uploadReferenceSchema.safeParse(value).success;
}

export function isRepeaterRow(value: unknown): value is RepeaterRow {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every((item) =>
    typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean',
  ));
}

export function isRepeaterValue(value: unknown): value is RepeaterRow[] {
  return Array.isArray(value) && value.every(isRepeaterRow);
}

export function validateDefinition(definition: unknown): FormDefinition {
  return formDefinitionSchema.parse(definition);
}
