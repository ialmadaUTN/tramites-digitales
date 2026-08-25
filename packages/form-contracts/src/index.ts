import { z } from 'zod';
export type { Database, Json } from './database.types.js';
export { FIELD_NAME_INVALID_MESSAGE, FIELD_NAME_PATTERN, fieldNameError } from './field-name.js';
import { FIELD_NAME_INVALID_MESSAGE, FIELD_NAME_PATTERN } from './field-name.js';
export { REQUIRED_CONFLICT_MESSAGE, canBecomeRequired, hasRequiredConflict } from './required-semantics.js';
import { canBecomeRequired, hasRequiredConflict, REQUIRED_CONFLICT_MESSAGE } from './required-semantics.js';

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
  textTemplateError,
  TEXT_LENGTH_FIELD_TYPES,
  containerFields,
  containerItems,
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

export const externalVariableTypeSchema = z.enum(['string', 'number', 'boolean']);
export type ExternalVariableType = z.infer<typeof externalVariableTypeSchema>;

export const externalVariableTrustSchema = z.enum(['trusted', 'presentation']);
export type ExternalVariableTrust = z.infer<typeof externalVariableTrustSchema>;

export const externalVariableSchema = z.object({
  name: fieldNameSchema,
  label: z.string().trim().min(1),
  type: externalVariableTypeSchema,
  trust: externalVariableTrustSchema.default('presentation'),
});
export type ExternalVariable = z.infer<typeof externalVariableSchema>;

const conditionSourceSchema = z.union([
  z.object({ kind: z.literal('field'), fieldId: z.string().min(1) }),
  z.object({ kind: z.literal('external'), variable: fieldNameSchema }),
]);
export type ConditionSource = z.infer<typeof conditionSourceSchema>;

/**
 * `fieldId` is kept as a read-compatible shorthand for v2 definitions. New
 * definitions should use the discriminated `source` member.
 */
export const conditionRuleSchema = z.object({
  fieldId: z.string().min(1).optional(),
  source: conditionSourceSchema.optional(),
  operator: conditionOperatorSchema,
  value: z.unknown().optional(),
}).superRefine((rule, ctx) => {
  if (!rule.fieldId && !rule.source) ctx.addIssue({ code: 'custom', path: ['source'], message: 'La condición necesita un origen' });
  if (rule.fieldId && rule.source) ctx.addIssue({ code: 'custom', path: ['source'], message: 'No se puede declarar fieldId y source a la vez' });
  if (['in', 'notIn'].includes(rule.operator) && (!Array.isArray(rule.value) || rule.value.length === 0)) {
    ctx.addIssue({ code: 'custom', path: ['value'], message: 'Los operadores de inclusión requieren una lista no vacía' });
  }
  if (['equals', 'notEquals', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual'].includes(rule.operator) && Array.isArray(rule.value)) {
    ctx.addIssue({ code: 'custom', path: ['value'], message: 'La regla requiere un valor escalar' });
  }
  if (!['empty', 'notEmpty', 'in', 'notIn'].includes(rule.operator) && rule.value === undefined) {
    ctx.addIssue({ code: 'custom', path: ['value'], message: 'La regla necesita un valor esperado' });
  }
});
export type ConditionRule = z.infer<typeof conditionRuleSchema>;

export type ConditionGroup = {
  logic: 'all' | 'any';
  rules: ConditionRule[];
  groups?: ConditionGroup[];
};

/** Limits that keep author-supplied expressions bounded for every evaluator. */
export const MAX_CONDITION_DEPTH = 8;
export const MAX_CONDITION_TERMS = 50;

function conditionStats(group: ConditionGroup, depth = 1): { depth: number; terms: number } {
  return (group.groups ?? []).reduce(
    (stats, child) => {
      const childStats = conditionStats(child, depth + 1);
      return { depth: Math.max(stats.depth, childStats.depth), terms: stats.terms + childStats.terms };
    },
    { depth, terms: group.rules.length },
  );
}

function conditionLeaves(group: ConditionGroup | undefined): ConditionRule[] {
  if (!group) return [];
  return [...group.rules, ...(group.groups ?? []).flatMap((child) => conditionLeaves(child))];
}

export const conditionGroupSchema: z.ZodType<ConditionGroup> = z.lazy(() => z.object({
  logic: z.enum(['all', 'any']),
  rules: z.array(conditionRuleSchema).default([]),
  groups: z.array(conditionGroupSchema).optional(),
}).superRefine((group, ctx) => {
  if (group.rules.length === 0 && (!group.groups || group.groups.length === 0)) {
    ctx.addIssue({ code: 'custom', path: ['rules'], message: 'La condición necesita al menos una regla o grupo' });
  }
  const stats = conditionStats(group);
  if (stats.depth > MAX_CONDITION_DEPTH) {
    ctx.addIssue({ code: 'custom', path: ['groups'], message: `La condición no puede superar ${MAX_CONDITION_DEPTH} niveles` });
  }
  if (stats.terms > MAX_CONDITION_TERMS) {
    ctx.addIssue({ code: 'custom', path: ['rules'], message: `La condición no puede superar ${MAX_CONDITION_TERMS} reglas` });
  }
}));

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
  included: conditionGroupSchema.optional(),
  required: conditionGroupSchema.optional(),
});
export type FieldConditions = z.infer<typeof fieldConditionsSchema>;

export const elementConditionsSchema = z.object({
  visible: conditionGroupSchema.optional(),
  enabled: conditionGroupSchema.optional(),
  included: conditionGroupSchema.optional(),
});
export type ElementConditions = z.infer<typeof elementConditionsSchema>;

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

export const textBlockSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('textBlock'),
  title: z.string().optional(),
  text: z.string().min(1).refine((value) => value.trim().length > 0, 'El contenido del bloque no puede estar vacío'),
  conditions: z.object({ visible: conditionGroupSchema.optional() }).strict().optional(),
});
export type TextBlock = z.infer<typeof textBlockSchema>;

export const formItemSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('field'), field: formFieldSchema }),
  textBlockSchema,
]);
export type FormItem = z.infer<typeof formItemSchema>;

export const formContainerSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: z.enum(['section', 'repeater']).optional(),
  fieldName: fieldNameSchema.optional(),
  columns: z.union([z.literal(1), z.literal(2)]).default(1),
  minRows: z.number().int().nonnegative().optional(),
  maxRows: z.number().int().positive().max(50).optional(),
  /** Legacy field list. v3 uses `items` to preserve field/block order. */
  fields: z.array(formFieldSchema).default([]),
  items: z.array(formItemSchema).optional(),
  conditions: elementConditionsSchema.optional(),
});
export type FormContainer = z.infer<typeof formContainerSchema>;

export const formDefinitionSchema = z
  .object({
    schemaVersion: z.union([z.literal(2), z.literal(3)]).optional(),
    tipificationKey: z.string().trim().min(1).optional(),
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    submitLabel: z.string().min(1).max(80).default('Enviar'),
    conditions: elementConditionsSchema.optional(),
    externalVariables: z.array(externalVariableSchema).optional(),
    containers: z.array(formContainerSchema),
  })
  .superRefine((definition, ctx) => {
    const isV2 = definition.schemaVersion === 2 || definition.schemaVersion === 3;
    const isV3 = definition.schemaVersion === 3;
    const v2FieldTypes = new Set<FieldType>(['email', 'phone', 'alphabetic', 'alphanumeric', 'multiselect', 'fileUpload']);
    const repeaterFieldTypes = new Set<FieldType>(REPEATER_FIELD_TYPES);
    const fieldIds = new Set<string>();
    const allFieldIds = new Set<string>();
    const fieldNames = new Set<string>();
    const fieldsById = new Map<string, FormField>();
    const externalVariables = definition.externalVariables ?? [];
    const externalNames = new Set<string>();
    for (const [index, variable] of externalVariables.entries()) {
      if (externalNames.has(variable.name)) {
        ctx.addIssue({ code: 'custom', path: ['externalVariables', index, 'name'], message: `Variable externa duplicada: ${variable.name}` });
      }
      externalNames.add(variable.name);
    }
    if (isV3 && !definition.externalVariables) {
      // An absent catalog is equivalent to an empty catalog, but keeping the
      // key explicit makes the v3 contract self-describing after save.
      ctx.addIssue({ code: 'custom', path: ['externalVariables'], message: 'Un formulario v3 requiere catálogo de variables externas' });
    }
    if (!isV3 && definition.externalVariables && definition.externalVariables.length > 0) {
      ctx.addIssue({ code: 'custom', path: ['externalVariables'], message: 'Las variables externas requieren schemaVersion 3' });
    }
    if (!isV3 && definition.conditions) {
      ctx.addIssue({ code: 'custom', path: ['conditions'], message: 'Las condiciones del formulario requieren schemaVersion 3' });
    }
    if (isV2 && !definition.tipificationKey) {
      ctx.addIssue({ code: 'custom', path: ['tipificationKey'], message: 'Un formulario v2 requiere tipificationKey' });
    }
    definition.containers.forEach((container, containerIndex) => {
      const isRepeater = container.kind === 'repeater';
      if (!isV3 && container.conditions) {
        ctx.addIssue({ code: 'custom', path: ['containers', containerIndex, 'conditions'], message: 'Las condiciones de sección requieren schemaVersion 3' });
      }
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
        if (container.items?.some((item) => item.kind === 'textBlock')) {
          ctx.addIssue({ code: 'custom', path: ['containers', containerIndex, 'items'], message: 'Las grillas solo pueden contener campos' });
        }
        const repeaterFieldIds = new Set<string>();
        const repeaterFieldNames = new Set<string>();
        for (const [fieldIndex, field] of containerFields(container).entries()) {
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
      containerFields(container).forEach((field, fieldIndex) => {
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
        if (hasRequiredConflict(field)) {
          ctx.addIssue({ code: 'custom', path: [...fieldPath, 'conditions', 'required'], message: REQUIRED_CONFLICT_MESSAGE });
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
        // `canBecomeRequired` y no `rules.required`: con obligatoriedad condicional
        // el campo se exige cuando la condición se cumple, y al ser de solo lectura
        // nadie puede completarlo. Sin default, el formulario queda imposible de enviar.
        if (field.readOnly && canBecomeRequired(field) && field.defaultValue === undefined) {
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
          if (!isV3 && field.conditions?.included) {
            ctx.addIssue({ code: 'custom', path: [...fieldPath, 'conditions', 'included'], message: 'La inclusión condicional requiere schemaVersion 3' });
          }
          for (const [conditionKey, condition] of Object.entries(field.conditions ?? {})) {
          for (const [ruleIndex, rule] of conditionLeaves(condition).entries()) {
            const source = sourceOf(rule);
            if (source?.kind === 'field' && source.fieldId === field.id) {
              ctx.addIssue({ code: 'custom', path: [...fieldPath, 'conditions', conditionKey, 'rules', ruleIndex, 'fieldId'], message: `La condición de ${field.id} se referencia a sí misma` });
            }
            if (source?.kind === 'external' && !externalNames.has(source.variable)) {
              ctx.addIssue({ code: 'custom', path: [...fieldPath, 'conditions', conditionKey, 'rules', ruleIndex, 'source'], message: `Variable externa no declarada: ${source.variable}` });
            }
            if (source?.kind === 'field' && !fieldIds.has(source.fieldId) && !definition.containers.filter((candidate) => candidate.kind !== 'repeater').some((candidate) => containerFields(candidate).some((candidateField) => candidateField.id === source.fieldId))) {
              ctx.addIssue({ code: 'custom', path: [...fieldPath, 'conditions', conditionKey, 'rules', ruleIndex, 'fieldId'], message: `Campo referido inexistente: ${rule.fieldId}` });
            }
          }
          }
        }
      });
    });

    const externalByName = new Map(externalVariables.map((variable) => [variable.name, variable]));
    const validateConditionGroups = (
      groups: Record<string, ConditionGroup | undefined>,
      path: (string | number)[],
      owner: 'form' | 'container' | 'field' | 'textBlock',
      descendantFieldIds?: Set<string>,
    ) => {
      for (const [key, group] of Object.entries(groups)) {
        for (const [ruleIndex, rule] of conditionLeaves(group).entries()) {
          const source = sourceOf(rule);
          if (owner !== 'field' && source?.kind === 'field' && !fieldIds.has(source.fieldId)) {
            ctx.addIssue({ code: 'custom', path: [...path, key, 'rules', ruleIndex, 'source'], message: `Campo referido inexistente: ${source.fieldId}` });
          }
          if (source?.kind === 'field' && descendantFieldIds?.has(source.fieldId)) {
            ctx.addIssue({ code: 'custom', path: [...path, key, 'rules', ruleIndex, 'source'], message: `La condición de ${owner} no puede depender de uno de sus descendientes` });
          }
          if (source?.kind !== 'external') continue;
          if (!isV3) ctx.addIssue({ code: 'custom', path: [...path, key, 'rules', ruleIndex, 'source'], message: 'Las variables externas requieren schemaVersion 3' });
          const variable = externalByName.get(source.variable);
          if (!variable) {
            ctx.addIssue({ code: 'custom', path: [...path, key, 'rules', ruleIndex, 'source'], message: `Variable externa no declarada: ${source.variable}` });
            continue;
          }
          if (variable.trust === 'presentation' && owner !== 'textBlock') {
            ctx.addIssue({ code: 'custom', path: [...path, key, 'rules', ruleIndex, 'source'], message: 'Las variables de presentación solo pueden controlar bloques informativos' });
          }
          const values = Array.isArray(rule.value) ? rule.value : [rule.value];
          for (const value of values) {
            if (value === undefined || ['empty', 'notEmpty'].includes(rule.operator)) continue;
            const compatible = variable.type === 'string' ? typeof value === 'string' : variable.type === 'number' ? typeof value === 'number' && Number.isFinite(value) : typeof value === 'boolean';
            if (!compatible) ctx.addIssue({ code: 'custom', path: [...path, key, 'rules', ruleIndex, 'value'], message: `El valor esperado no coincide con el tipo ${variable.type}` });
          }
          if (['greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual'].includes(rule.operator) && variable.type !== 'number') {
            ctx.addIssue({ code: 'custom', path: [...path, key, 'rules', ruleIndex, 'operator'], message: 'Las comparaciones numéricas requieren una variable number' });
          }
        }
      }
    };
    validateConditionGroups(definition.conditions ?? {}, ['conditions'], 'form', new Set(fieldIds));
    definition.containers.forEach((container, containerIndex) => {
      validateConditionGroups(container.conditions ?? {}, ['containers', containerIndex, 'conditions'], 'container', new Set(containerFields(container).map((field) => field.id)));
      for (const [fieldIndex, field] of containerFields(container).entries()) {
        validateConditionGroups(field.conditions ?? {}, ['containers', containerIndex, 'fields', fieldIndex, 'conditions'], 'field');
      }
      for (const [itemIndex, item] of containerItems(container).entries()) {
        if (item.kind === 'textBlock') {
          if (!isV3) ctx.addIssue({ code: 'custom', path: ['containers', containerIndex, 'items', itemIndex], message: 'Los bloques informativos requieren schemaVersion 3' });
          for (const [key, value] of [['title', item.title], ['text', item.text]] as const) {
            if (value !== undefined) {
              const templateError = textTemplateError(value, externalByName.keys());
              if (templateError) ctx.addIssue({ code: 'custom', path: ['containers', containerIndex, 'items', itemIndex, key], message: templateError });
            }
          }
          validateConditionGroups(item.conditions ?? {}, ['containers', containerIndex, 'items', itemIndex, 'conditions'], 'textBlock');
        }
      }
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
      const dependencies = Object.values(field.conditions ?? {})
        .flatMap((group) => conditionLeaves(group))
        .map((rule) => sourceOf(rule))
        .filter((source): source is { kind: 'field'; fieldId: string } => source?.kind === 'field')
        .map((source) => source.fieldId);
      for (const dependency of dependencies) visit(dependency, [...path, fieldId]);
      visiting.delete(fieldId);
      visited.add(fieldId);
    };
    for (const fieldId of fieldsById.keys()) visit(fieldId, []);
  });
export type FormDefinition = z.infer<typeof formDefinitionSchema>;

export { upgradeDefinitionToV2, upgradeDefinitionToV3 } from './migrations.js';

/**
 * Upgrades a legacy definition when it enters the CMS. Published v1 versions
 * remain untouched; the next draft save becomes an explicit v2 definition
 * without changing the behavior of existing fields.
 */
export const dynamicFormPropsSchema = z.object({
  formId: z.string().uuid(),
  apiBaseUrl: z.string().url(),
  mode: z.enum(['published', 'draft']).optional(),
  externalVariables: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]).optional()).optional(),
  contextToken: z.string().min(1).optional(),
});
export type DynamicFormPreviewState = {
  visible: boolean;
  enabled: boolean;
  included: boolean;
  payload: Record<string, FormValue>;
};
export type DynamicFormProps = z.infer<typeof dynamicFormPropsSchema> & {
  onSubmitted?: (receipt: SubmissionReceipt) => void;
  onError?: (error: FormRuntimeError) => void;
  /**
   * Optional local observation hook used by the CMS preview. It is never part
   * of the serialized props contract and does not grant any server authority.
   */
  onPreviewStateChange?: (state: DynamicFormPreviewState) => void;
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
    .flatMap((container) => containerFields(container));
}

export function repeaterContainers(definition: FormDefinition): FormContainer[] {
  return definition.containers.filter((container) => container.kind === 'repeater');
}

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return Array.isArray(value) && value.length === 0;
}

export type ExternalVariableValues = Record<string, unknown>;
export type ConditionValues = {
  fields?: Record<string, unknown>;
  external?: ExternalVariableValues;
};

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
  // Absence is intentionally not equal to an empty literal. Use the explicit
  // `empty` operator when a rule should match undefined/null/blank values.
  if (actual === undefined || actual === null) return false;
  if (expected === undefined || expected === null) return false;
  if (Object.is(actual, expected)) return true;
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

function sourceOf(rule: ConditionRule): ConditionSource | undefined {
  if (rule.source) return rule.source;
  if (rule.fieldId) return { kind: 'field', fieldId: rule.fieldId };
  return undefined;
}

function evaluateRule(rule: ConditionRule, values: Record<string, unknown>, external: ExternalVariableValues): boolean {
  const source = sourceOf(rule);
  if (!source) return false;
  const actual = source.kind === 'external' ? external[source.variable] : values[source.fieldId];
  const expectedList = Array.isArray(rule.value) ? rule.value as unknown[] : undefined;
  switch (rule.operator) {
    case 'equals': return valuesEqual(actual, rule.value);
    case 'notEquals': return actual === undefined || actual === null ? true : !valuesEqual(actual, rule.value);
    case 'in':
      return Boolean(expectedList) && (Array.isArray(actual)
        ? actual.some((entry) => expectedList!.some((item) => valuesEqual(entry, item)))
        : expectedList!.some((item) => valuesEqual(actual, item)));
    case 'notIn':
      return Boolean(expectedList) && (Array.isArray(actual)
        ? actual.every((entry) => !expectedList!.some((item) => valuesEqual(entry, item)))
        : actual === undefined || actual === null || !expectedList!.some((item) => valuesEqual(actual, item)));
    case 'greaterThan': return asFiniteNumber(actual) !== undefined && asFiniteNumber(rule.value) !== undefined && asFiniteNumber(actual)! > asFiniteNumber(rule.value)!;
    case 'greaterThanOrEqual': return asFiniteNumber(actual) !== undefined && asFiniteNumber(rule.value) !== undefined && asFiniteNumber(actual)! >= asFiniteNumber(rule.value)!;
    case 'lessThan': return asFiniteNumber(actual) !== undefined && asFiniteNumber(rule.value) !== undefined && asFiniteNumber(actual)! < asFiniteNumber(rule.value)!;
    case 'lessThanOrEqual': return asFiniteNumber(actual) !== undefined && asFiniteNumber(rule.value) !== undefined && asFiniteNumber(actual)! <= asFiniteNumber(rule.value)!;
    case 'empty': return isEmpty(actual);
    case 'notEmpty': return !isEmpty(actual);
  }
}

export function evaluateCondition(group: ConditionGroup | undefined, values: Record<string, unknown>, external: ExternalVariableValues = {}): boolean {
  if (!group) return true;
  const results = [
    ...group.rules.map((rule) => evaluateRule(rule, values, external)),
    ...(group.groups ?? []).map((child) => evaluateCondition(child, values, external)),
  ];
  return group.logic === 'all' ? results.every(Boolean) : results.some(Boolean);
}

export function isElementVisible(conditions: ElementConditions | undefined, values: Record<string, unknown>, external: ExternalVariableValues = {}): boolean {
  return evaluateCondition(conditions?.visible, values, external);
}

export function isElementEnabled(conditions: ElementConditions | undefined, values: Record<string, unknown>, external: ExternalVariableValues = {}): boolean {
  return evaluateCondition(conditions?.enabled, values, external);
}

export function isElementIncluded(conditions: ElementConditions | undefined, values: Record<string, unknown>, external: ExternalVariableValues = {}): boolean {
  return evaluateCondition(conditions?.included, values, external);
}

export function isFieldVisible(field: FormField, values: Record<string, unknown>, external: ExternalVariableValues = {}): boolean {
  return evaluateCondition(field.conditions?.visible, values, external);
}

export function isFieldEnabled(field: FormField, values: Record<string, unknown>, external: ExternalVariableValues = {}): boolean {
  return evaluateCondition(field.conditions?.enabled, values, external);
}

export function isFieldIncluded(field: FormField, values: Record<string, unknown>, external: ExternalVariableValues = {}): boolean {
  return evaluateCondition(field.conditions?.included, values, external);
}

/**
 * Obligatoriedad **declarada**: fija o condicional. El contrato garantiza que no
 * pueden estar las dos (ver `required-semantics.ts`), así que el `||` no arrastra
 * ninguna ambigüedad: solo una de las dos ramas puede estar configurada.
 *
 * Esto no dice si el campo se exige *ahora*. Ese criterio necesita además la
 * visibilidad, la inclusión y la habilitación —propias y de los contenedores que
 * lo envuelven— y lo arman `validateSubmission` y `DynamicField`, que son los
 * únicos que tienen ese contexto.
 */
export function isFieldRequired(field: FormField, values: Record<string, unknown>, external: ExternalVariableValues = {}): boolean {
  return Boolean(field.rules.required) || Boolean(field.conditions?.required && evaluateCondition(field.conditions.required, values, external));
}

export function cleanSubmissionPayload(definition: FormDefinition, payload: Record<string, unknown>, external: ExternalVariableValues = {}): Record<string, FormValue> {
  const output: Record<string, FormValue> = {};
  const valuesById: Record<string, unknown> = {};
  for (const field of flattenFields(definition)) valuesById[field.id] = payload[field.fieldName];
  if (!isElementVisible(definition.conditions, valuesById, external) || !isElementIncluded(definition.conditions, valuesById, external) || !isElementEnabled(definition.conditions, valuesById, external)) return output;
  for (const container of definition.containers) {
    const containerVisible = isElementVisible(container.conditions, valuesById, external);
    const containerIncluded = isElementIncluded(container.conditions, valuesById, external);
    if (!containerVisible || !containerIncluded) continue;
    if (container.kind === 'repeater') {
      const value = container.fieldName ? payload[container.fieldName] : undefined;
      if (value !== undefined && value !== null && value !== '' && isRepeaterValue(value) && container.fieldName) output[container.fieldName] = value;
      continue;
    }
    for (const field of containerFields(container)) {
      if (!isFieldVisible(field, valuesById, external) || !isFieldIncluded(field, valuesById, external)) continue;
      const value = payload[field.fieldName];
      if (value !== undefined && value !== null && value !== '' && isFormValue(value)) output[field.fieldName] = value;
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
