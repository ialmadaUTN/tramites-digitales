import type { FormField } from '@tramites/form-contracts';
import type { FormValues } from '../../../shared/types/form-values';

export function valuesByFieldId(fieldMap: Map<string, FormField>, values: FormValues): FormValues {
  const byId: FormValues = {};
  for (const [id, field] of fieldMap) byId[id] = values[field.fieldName];
  return byId;
}
