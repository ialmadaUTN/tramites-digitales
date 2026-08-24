import {
  cleanSubmissionPayload,
  isElementEnabled,
  isElementIncluded,
  isElementVisible,
  flattenFields,
  type DynamicFormPreviewState,
  type ExternalVariableValues,
  type FormDefinition,
} from '@tramites/form-contracts';
import { valuesByFieldId } from './field-state';

/**
 * Calculates the state exposed to the CMS preview without changing the
 * runtime's submission behavior. The payload uses the same cleaning rules as
 * a real submission, so hidden and excluded values are visible as omitted.
 */
export function evaluatePreviewState(
  definition: FormDefinition,
  values: Record<string, unknown>,
  externalVariables: ExternalVariableValues = {},
): DynamicFormPreviewState {
  const fieldMap = new Map(flattenFields(definition).map((field) => [field.id, field]));
  const conditionValues = valuesByFieldId(fieldMap, values);
  const visible = isElementVisible(definition.conditions, conditionValues, externalVariables);
  const enabled = isElementEnabled(definition.conditions, conditionValues, externalVariables);
  const included = isElementIncluded(definition.conditions, conditionValues, externalVariables);

  return {
    visible,
    enabled,
    included,
    payload: cleanSubmissionPayload(definition, values, externalVariables),
  };
}
