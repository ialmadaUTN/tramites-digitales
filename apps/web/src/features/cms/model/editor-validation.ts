import type { ConditionGroup, ConditionRule, ExternalVariable, FormContainer, FormDefinition, FormField } from '@tramites/form-contracts';
import { containerFields } from '@tramites/form-contracts/field-rules';
import { duplicateOptionValues, isMaskCompatible, isValidRegexPattern, optionCatalogIncludes } from '@tramites/form-contracts/field-rules';
import { fieldNameError } from '@tramites/form-contracts/field-name';
import { validateFieldDefaultValue } from '@tramites/form-contracts/default-value-validation';
import { structuralIssues } from '@tramites/form-contracts/structural-validation';
import {
  LENGTH_RULE_FIELD_TYPES,
  OPTION_FIELD_TYPES,
  READ_ONLY_BLOCKED_FIELD_TYPES,
  REPEATER_FIELD_TYPES,
} from './constants';
import { textBlockTemplateError } from './definition';

export type FieldEditorErrors = {
  fieldName?: string;
  label?: string;
  type?: string;
  options?: string;
  defaultValue?: string;
  pattern?: string;
  length?: string;
  range?: string;
  mask?: string;
  files?: string;
  readOnly?: string;
  conditions?: string;
};

export type ContainerEditorErrors = {
  title?: string;
  fieldName?: string;
  rows?: string;
  /** Contenedor sin contenido. Bloquea publicar, no guardar. */
  fields?: string;
  conditions?: string;
};

export type TextBlockEditorErrors = {
  title?: string;
  text?: string;
};

export type DefinitionEditorErrors = {
  name?: string;
  title?: string;
  submitLabel?: string;
  tipificationKey?: string;
  conditions?: string;
  /** Formulario sin contenedores. Bloquea publicar, no guardar. */
  structure?: string;
  containers: Record<string, ContainerEditorErrors>;
  fields: Record<string, FieldEditorErrors>;
  textBlocks: Record<string, TextBlockEditorErrors>;
  /**
   * Algo mal definido: bloquea guardar. Los problemas de completitud
   * estructural no cuentan acá, porque un borrador a medias se puede guardar.
   */
  hasErrors: boolean;
  /** Completo y bien definido: recién ahí se puede publicar. */
  canPublish: boolean;
};

const isWholeNumber = (value: number | undefined): boolean => value === undefined || Number.isInteger(value);

function optionErrors(field: FormField): string | undefined {
  const options = field.options ?? [];
  if (OPTION_FIELD_TYPES.includes(field.type) && options.length === 0) {
    return 'Este tipo de campo necesita al menos una opción';
  }
  if (options.some((option) => !option.label.trim())) return 'Hay opciones sin etiqueta visible';
  if (options.some((option) => String(option.value).trim() === '')) return 'Hay opciones sin valor interno';
  const duplicates = duplicateOptionValues(options);
  if (duplicates.length > 0) return `Valores de opción duplicados: ${duplicates.join(', ')}`;
  return undefined;
}

function defaultValueError(field: FormField): string | undefined {
  const current = field.defaultValue;
  if (current === undefined) return undefined;
  if (Array.isArray(current) && field.type !== 'multiselect') {
    return 'Solo la selección múltiple admite varios valores por defecto';
  }
  if (!Array.isArray(current) && field.type === 'multiselect') {
    return 'La selección múltiple espera una lista de valores por defecto';
  }
  if (field.type === 'number' && (typeof current !== 'number' || !Number.isFinite(current))) {
    return 'El valor por defecto debe ser un número';
  }
  if (field.type === 'checkbox' && typeof current !== 'boolean') {
    return 'El valor por defecto de una casilla debe ser true o false';
  }
  if (field.type === 'fileUpload') return 'Los campos de archivos no admiten valor por defecto';

  const checksCatalog =
    OPTION_FIELD_TYPES.includes(field.type) && (field.type !== 'combobox' || field.allowCustomValue === false);
  if (checksCatalog) {
    const candidates = Array.isArray(current) ? current : [current];
    const outsiders = candidates.filter((candidate) => !optionCatalogIncludes(field.options, candidate));
    if (outsiders.length > 0) return `El valor por defecto no está en el catálogo: ${outsiders.map(String).join(', ')}`;
  }
  return validateFieldDefaultValue(field);
}

function ruleErrors(field: FormField): Pick<FieldEditorErrors, 'pattern' | 'length' | 'range' | 'mask' | 'files'> {
  const errors: Pick<FieldEditorErrors, 'pattern' | 'length' | 'range' | 'mask' | 'files'> = {};
  const { pattern, minLength, maxLength, min, max } = field.rules;

  if (pattern !== undefined && pattern.trim() !== '' && !isValidRegexPattern(pattern)) {
    errors.pattern = 'La expresión regular no es válida';
  }

  if ((minLength !== undefined || maxLength !== undefined) && !LENGTH_RULE_FIELD_TYPES.includes(field.type)) {
    errors.length = 'Este tipo de campo no admite reglas de longitud';
  } else if (!isWholeNumber(minLength) || !isWholeNumber(maxLength)) {
    errors.length = 'La longitud debe expresarse en números enteros';
  } else if ((minLength ?? 0) < 0 || (maxLength ?? 0) < 0) {
    errors.length = 'La longitud no puede ser negativa';
  } else if (minLength !== undefined && maxLength !== undefined && minLength > maxLength) {
    errors.length = 'El mínimo de caracteres no puede superar el máximo';
  }

  if ((min !== undefined || max !== undefined) && field.type !== 'number') {
    errors.range = 'Solo los campos numéricos admiten un rango';
  } else if (min !== undefined && max !== undefined && min > max) {
    errors.range = 'El mínimo numérico no puede superar el máximo';
  }

  if (field.maskKind && !isMaskCompatible(field.type, field.maskKind)) {
    errors.mask = `${field.maskKind} no es compatible con el tipo ${field.type}`;
  }

  const { minFiles, maxFiles, allowedMimeTypes } = field;
  if ((minFiles !== undefined || maxFiles !== undefined || allowedMimeTypes !== undefined) && field.type !== 'fileUpload') {
    errors.files = 'La configuración de archivos solo aplica a campos de archivos';
  } else if (allowedMimeTypes !== undefined && allowedMimeTypes.length === 0) {
    errors.files = 'Seleccioná al menos un tipo de archivo';
  } else if (!isWholeNumber(minFiles) || !isWholeNumber(maxFiles)) {
    errors.files = 'La cantidad de archivos debe ser un número entero';
  } else if ((minFiles ?? 0) < 0 || (maxFiles ?? 1) < 1 || (maxFiles ?? 1) > 5) {
    errors.files = 'Se admiten entre 1 y 5 archivos';
  } else if (minFiles !== undefined && maxFiles !== undefined && minFiles > maxFiles) {
    errors.files = 'El mínimo de archivos no puede superar el máximo';
  }

  return errors;
}

function readOnlyError(field: FormField): string | undefined {
  if (!field.readOnly) return undefined;
  if (READ_ONLY_BLOCKED_FIELD_TYPES.includes(field.type)) return 'Este tipo de campo no admite solo lectura';
  if (field.rules.required && field.defaultValue === undefined) {
    return 'Un campo obligatorio de solo lectura necesita un valor por defecto';
  }
  return undefined;
}

function conditionLeaves(group: ConditionGroup | undefined): ConditionRule[] {
  return group ? [...group.rules, ...(group.groups ?? []).flatMap((child) => conditionLeaves(child))] : [];
}

function externalOperandError(rule: ConditionRule, variable: ExternalVariable): string | undefined {
  if (['in', 'notIn'].includes(rule.operator)) {
    if (!Array.isArray(rule.value) || rule.value.length === 0) return 'Los operadores de inclusión requieren al menos un valor';
  } else if (!['empty', 'notEmpty'].includes(rule.operator)) {
    if (Array.isArray(rule.value)) return 'La regla requiere un valor escalar';
    if (rule.value === undefined || rule.value === '') return 'Completá el valor esperado de la condición';
  }
  if (['greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual'].includes(rule.operator) && variable.type !== 'number') {
    return 'Las comparaciones numéricas requieren una variable number';
  }
  if (['empty', 'notEmpty'].includes(rule.operator)) return undefined;
  const values = Array.isArray(rule.value) ? rule.value : [rule.value];
  const compatible = values.every((value) => variable.type === 'string'
    ? typeof value === 'string'
    : variable.type === 'number'
      ? typeof value === 'number' && Number.isFinite(value)
      : typeof value === 'boolean');
  return compatible ? undefined : `El valor esperado no coincide con el tipo ${variable.type}`;
}

function conditionErrors(field: FormField, insideRepeater: boolean, candidateIds: Set<string>, externalVariables: ExternalVariable[]): string | undefined {
  const groups = Object.entries(field.conditions ?? {}).filter(([, group]) => group);
  if (groups.length === 0) return undefined;
  if (insideRepeater) return 'Las celdas de una grilla no admiten condiciones';
  for (const [, group] of groups) {
    if (!group || conditionLeaves(group).length === 0) return 'Cada condición necesita al menos una regla';
    for (const rule of conditionLeaves(group)) {
      const source = rule.source ?? (rule.fieldId ? { kind: 'field' as const, fieldId: rule.fieldId } : undefined);
      if (!source) return 'La condición necesita un origen';
      if (source.kind === 'field' && source.fieldId === field.id) return 'Una condición no puede depender del propio campo';
      if (source.kind === 'field' && !candidateIds.has(source.fieldId)) return 'La condición apunta a un campo inexistente o a una celda de grilla';
      if (source.kind === 'external') {
        const variable = externalVariables.find((candidate) => candidate.name === source.variable);
        if (!variable) return 'La condición apunta a una variable externa no declarada';
        if (variable.trust === 'presentation') return 'Las variables de presentación solo pueden controlar bloques informativos';
        const operandError = externalOperandError(rule, variable);
        if (operandError) return operandError;
      }
      if (['in', 'notIn'].includes(rule.operator)) {
        if (!Array.isArray(rule.value) || rule.value.length === 0) {
          return 'Los operadores de inclusión requieren al menos un valor';
        }
        continue;
      }
      const needsValue = !['empty', 'notEmpty'].includes(rule.operator);
      if (needsValue && (rule.value === undefined || rule.value === '')) {
        return 'Completá el valor esperado de la condición';
      }
    }
  }
  return undefined;
}

function elementConditionErrors(
  groups: Record<string, ConditionGroup | undefined> | undefined,
  owner: 'form' | 'container',
  descendantIds: Set<string>,
  externalVariables: ExternalVariable[],
  availableIds: Set<string> = descendantIds,
): string | undefined {
  for (const group of Object.values(groups ?? {})) {
    if (conditionLeaves(group).length === 0) return 'Cada condición necesita al menos una regla';
    for (const rule of conditionLeaves(group)) {
      const source = rule.source ?? (rule.fieldId ? { kind: 'field' as const, fieldId: rule.fieldId } : undefined);
      if (!source) return 'La condición necesita un origen';
      if (source.kind === 'field' && !availableIds.has(source.fieldId)) return 'La condición apunta a un campo inexistente o a una celda de grilla';
      if (source.kind === 'field' && descendantIds.has(source.fieldId)) return `La condición de ${owner} no puede depender de uno de sus descendientes`;
      if (source.kind === 'external') {
        const variable = externalVariables.find((candidate) => candidate.name === source.variable);
        if (!variable) return 'La condición apunta a una variable externa no declarada';
        if (variable.trust === 'presentation') return 'Las variables de presentación solo pueden controlar bloques informativos';
        const operandError = externalOperandError(rule, variable);
        if (operandError) return operandError;
      }
      if (['in', 'notIn'].includes(rule.operator) && (!Array.isArray(rule.value) || rule.value.length === 0)) return 'Los operadores de inclusión requieren al menos un valor';
      if (!['in', 'notIn', 'empty', 'notEmpty'].includes(rule.operator) && (rule.value === undefined || rule.value === '')) return 'Completá el valor esperado de la condición';
    }
  }
  return undefined;
}

function textBlockConditionError(
  group: ConditionGroup | undefined,
  candidateIds: Set<string>,
  externalVariables: ExternalVariable[],
): string | undefined {
  if (!group) return undefined;
  if (conditionLeaves(group).length === 0) return 'Cada condición necesita al menos una regla';
  for (const rule of conditionLeaves(group)) {
    const source = rule.source ?? (rule.fieldId ? { kind: 'field' as const, fieldId: rule.fieldId } : undefined);
    if (!source) return 'La condición necesita un origen';
    if (source.kind === 'field' && !candidateIds.has(source.fieldId)) return 'La condición apunta a un campo inexistente o a una celda de grilla';
    if (source.kind === 'external') {
      const variable = externalVariables.find((candidate) => candidate.name === source.variable);
      if (!variable) return 'La condición apunta a una variable externa no declarada';
      const operandError = externalOperandError(rule, variable);
      if (operandError) return operandError;
    }
  }
  return undefined;
}

function containerErrorsFor(container: FormContainer): ContainerEditorErrors {
  const errors: ContainerEditorErrors = {};
  if (!container.title.trim()) errors.title = 'El título del contenedor es obligatorio';
  if (container.kind !== 'repeater') return errors;

  const repeaterFieldNameError = fieldNameError(container.fieldName ?? '');
  if (repeaterFieldNameError) errors.fieldName = repeaterFieldNameError;
  // El contenedor sin contenido no se marca acá: es completitud estructural y la
  // resuelve `structuralIssues`, que también cubre las secciones y usa el mismo
  // mensaje que el contrato.

  const { minRows, maxRows } = container;
  if (!isWholeNumber(minRows) || !isWholeNumber(maxRows)) {
    errors.rows = 'La cantidad de filas debe expresarse en números enteros';
  } else if ((minRows ?? 0) < 0) {
    errors.rows = 'El mínimo de filas no puede ser negativo';
  } else if (maxRows !== undefined && (maxRows < 1 || maxRows > 50)) {
    errors.rows = 'El máximo de filas debe estar entre 1 y 50';
  } else if (minRows !== undefined && maxRows !== undefined && minRows > maxRows) {
    errors.rows = 'El mínimo de filas no puede superar el máximo';
  }
  return errors;
}

/**
 * Reproduce en el editor las reglas que el BFF aplica al guardar, para que el
 * autor vea el problema junto al campo en lugar de recibir un error genérico.
 */
export function collectDefinitionEditorErrors(definition: FormDefinition, name?: string): DefinitionEditorErrors {
  const containers: Record<string, ContainerEditorErrors> = {};
  const fields: Record<string, FieldEditorErrors> = {};
  const textBlocks: Record<string, TextBlockEditorErrors> = {};
  /** Claves de payload de primer nivel: campos sueltos y grillas comparten espacio. */
  const rootNames = new Map<string, string>();
  const candidateIds = new Set(
    definition.containers
      .filter((container) => container.kind !== 'repeater')
      .flatMap((container) => containerFields(container).map((field) => field.id)),
  );

  const nameError = name !== undefined && !name.trim() ? 'El nombre interno es obligatorio' : undefined;
  const titleError = !definition.title.trim() ? 'El título es obligatorio' : undefined;
  const submitLabelError = !definition.submitLabel.trim() ? 'La etiqueta del botón es obligatoria' : undefined;
  const tipificationKeyError = (definition.schemaVersion === 2 || definition.schemaVersion === 3) && !definition.tipificationKey?.trim()
    ? `La clave de tipificación es obligatoria en formularios v${definition.schemaVersion}`
    : undefined;

  const addFieldErrors = (fieldId: string, patch: FieldEditorErrors) => {
    const cleaned = Object.fromEntries(Object.entries(patch).filter(([, value]) => value));
    if (Object.keys(cleaned).length > 0) fields[fieldId] = { ...fields[fieldId], ...cleaned };
  };

  for (const container of definition.containers) {
    const errors = containerErrorsFor(container);
    const insideRepeater = container.kind === 'repeater';

    if (insideRepeater && container.fieldName && !errors.fieldName) {
      if (rootNames.has(container.fieldName)) errors.fieldName = 'Esta clave de payload ya se usa en el formulario';
      else rootNames.set(container.fieldName, container.id);
    }
    if (Object.keys(errors).length > 0) containers[container.id] = { ...containers[container.id], ...errors };

    /** Dentro de una grilla las claves solo tienen que ser únicas entre columnas. */
    const scopeNames = insideRepeater ? new Map<string, string>() : rootNames;

    for (const field of containerFields(container)) {
      const identifierError = fieldNameError(field.fieldName);
      const fieldErrors: FieldEditorErrors = {
        fieldName: identifierError,
        label: !field.label.trim() ? 'La etiqueta es obligatoria' : undefined,
        options: optionErrors(field),
        defaultValue: defaultValueError(field),
        readOnly: readOnlyError(field),
        conditions: conditionErrors(field, insideRepeater, candidateIds, definition.externalVariables ?? []),
        ...ruleErrors(field),
      };
      if (insideRepeater && !REPEATER_FIELD_TYPES.includes(field.type)) {
        fieldErrors.type = 'Este tipo de campo no está permitido dentro de una grilla';
      }

      if (!identifierError) {
        const previousId = scopeNames.get(field.fieldName);
        if (previousId) {
          const duplicate = 'Este nombre de clave ya se usa en otro campo';
          fieldErrors.fieldName = duplicate;
          if (previousId === container.id) {
            containers[container.id] = { ...containers[container.id], fieldName: duplicate };
          } else {
            addFieldErrors(previousId, { fieldName: duplicate });
          }
        } else {
          scopeNames.set(field.fieldName, field.id);
        }
      }

      addFieldErrors(field.id, fieldErrors);
    }

    for (const item of container.items ?? []) {
      if (item.kind !== 'textBlock') continue;
      const templateErrors = textBlockTemplateError(item, (definition.externalVariables ?? []).map((variable) => variable.name));
      if (Object.keys(templateErrors).length > 0) textBlocks[item.id] = templateErrors;
      const textBlockError = textBlockConditionError(item.conditions?.visible, candidateIds, definition.externalVariables ?? []);
      if (textBlockError) containers[container.id] = { ...containers[container.id], conditions: textBlockError };
    }
  }

  const formConditionError = elementConditionErrors(definition.conditions, 'form', new Set(candidateIds), definition.externalVariables ?? [], candidateIds);
  for (const container of definition.containers) {
    const conditionError = elementConditionErrors(container.conditions, 'container', new Set(containerFields(container).map((field) => field.id)), definition.externalVariables ?? [], candidateIds);
    if (conditionError) containers[container.id] = { ...containers[container.id], conditions: conditionError };
  }

  // Lo que bloquea **guardar**: algo mal definido. Se calcula antes de sumar los
  // problemas de completitud, que solo bloquean publicar.
  const hasErrors = Boolean(
    nameError || titleError || submitLabelError || tipificationKeyError || formConditionError
      || Object.keys(containers).length || Object.keys(fields).length || Object.keys(textBlocks).length,
  );

  // Completitud estructural, desde el contrato: mismo criterio y mismos mensajes
  // que aplica el BFF al publicar.
  const issues = structuralIssues(definition);
  let structure: string | undefined;
  for (const issue of issues) {
    if (!issue.containerId) {
      structure = issue.message;
      continue;
    }
    containers[issue.containerId] = { ...containers[issue.containerId], fields: issue.message };
  }

  return {
    name: nameError,
    title: titleError,
    submitLabel: submitLabelError,
    tipificationKey: tipificationKeyError,
    conditions: formConditionError,
    structure,
    containers,
    fields,
    textBlocks,
    hasErrors,
    canPublish: !hasErrors && issues.length === 0,
  };
}
