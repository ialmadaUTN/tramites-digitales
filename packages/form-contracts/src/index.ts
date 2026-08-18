import { z } from 'zod';
export type { Database, Json } from './database.types.js';
export { FIELD_NAME_INVALID_MESSAGE, FIELD_NAME_PATTERN, fieldNameError } from './field-name.js';
import { FIELD_NAME_INVALID_MESSAGE, FIELD_NAME_PATTERN } from './field-name.js';

export const fieldTypeSchema = z.enum([
  'text',
  'textarea',
  'number',
  'date',
  'time',
  'checkbox',
  'radio',
  'select',
  'combobox',
]);
export type FieldType = z.infer<typeof fieldTypeSchema>;

export const fieldNameSchema = z
  .string()
  .min(1, 'El nombre de clave es obligatorio')
  .regex(FIELD_NAME_PATTERN, FIELD_NAME_INVALID_MESSAGE);

export const optionSchema = z.object({
  label: z.string().min(1),
  value: z.union([z.string(), z.number()]),
});
export type FormOption = z.infer<typeof optionSchema>;

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

export const formFieldSchema = z.object({
  id: z.string().min(1),
  fieldName: fieldNameSchema,
  type: fieldTypeSchema,
  label: z.string().min(1),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  width: z.enum(['full', 'half']).default('full'),
  options: z.array(optionSchema).optional(),
  rules: fieldRulesSchema.default({}),
  conditions: fieldConditionsSchema.optional(),
});
export type FormField = z.infer<typeof formFieldSchema>;

export const formContainerSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  columns: z.union([z.literal(1), z.literal(2)]).default(1),
  fields: z.array(formFieldSchema),
});
export type FormContainer = z.infer<typeof formContainerSchema>;

export const formDefinitionSchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    submitLabel: z.string().min(1).max(80).default('Enviar'),
    containers: z.array(formContainerSchema),
  })
  .superRefine((definition, ctx) => {
    const fieldIds = new Set<string>();
    const fieldNames = new Set<string>();
    const fieldsById = new Map<string, FormField>();
    definition.containers.forEach((container, containerIndex) => {
      container.fields.forEach((field, fieldIndex) => {
        const fieldPath = ['containers', containerIndex, 'fields', fieldIndex] as const;
        if (fieldIds.has(field.id)) {
          ctx.addIssue({ code: 'custom', path: [...fieldPath, 'id'], message: `ID de campo duplicado: ${field.id}` });
        }
        if (fieldNames.has(field.fieldName)) {
          ctx.addIssue({ code: 'custom', path: [...fieldPath, 'fieldName'], message: `fieldName duplicado: ${field.fieldName}` });
        }
        fieldIds.add(field.id);
        fieldNames.add(field.fieldName);
        fieldsById.set(field.id, field);
        if (['select', 'radio', 'combobox'].includes(field.type) && (!field.options || field.options.length === 0)) {
          ctx.addIssue({ code: 'custom', path: [...fieldPath, 'options'], message: `${field.type} requiere opciones` });
        }
        for (const [conditionKey, condition] of Object.entries(field.conditions ?? {})) {
          for (const [ruleIndex, rule] of (condition?.rules ?? []).entries()) {
            if (rule.fieldId === field.id) {
              ctx.addIssue({ code: 'custom', path: [...fieldPath, 'conditions', conditionKey, 'rules', ruleIndex, 'fieldId'], message: `La condición de ${field.id} se referencia a sí misma` });
            }
            if (!fieldIds.has(rule.fieldId) && !definition.containers.some((candidate) => candidate.fields.some((candidateField) => candidateField.id === rule.fieldId))) {
              ctx.addIssue({ code: 'custom', path: [...fieldPath, 'conditions', conditionKey, 'rules', ruleIndex, 'fieldId'], message: `Campo referido inexistente: ${rule.fieldId}` });
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
  data: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
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
  return definition.containers.flatMap((container) => container.fields);
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

export function cleanSubmissionPayload(definition: FormDefinition, payload: Record<string, unknown>): Record<string, string | number | boolean> {
  const output: Record<string, string | number | boolean> = {};
  const valuesById: Record<string, unknown> = {};
  for (const field of flattenFields(definition)) valuesById[field.id] = payload[field.fieldName];
  for (const field of flattenFields(definition)) {
    if (!isFieldVisible(field, valuesById) || !isFieldEnabled(field, valuesById)) continue;
    const value = payload[field.fieldName];
    if (value !== undefined && value !== null && value !== '') {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') output[field.fieldName] = value;
    }
  }
  return output;
}

export function validateDefinition(definition: unknown): FormDefinition {
  return formDefinitionSchema.parse(definition);
}
