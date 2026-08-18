import { z } from 'zod';
import { flattenFields, FormDefinition, FormField, isFieldEnabled, isFieldRequired, isFieldVisible } from './index.js';

export type ValidationResult = { success: true; data: Record<string, string | number | boolean> } | { success: false; errors: Record<string, string> };

function empty(value: unknown): boolean {
  if (value === undefined || value === null || value === '' || value === false) return true;
  return typeof value === 'string' && value.trim() === '';
}

function message(field: FormField, key: keyof NonNullable<FormField['rules']['errorMessages']>, fallback: string): string {
  return field.rules.errorMessages?.[key] || fallback;
}

export function buildSubmissionSchema(definition: FormDefinition) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of flattenFields(definition)) shape[field.fieldName] = z.unknown().optional();
  return z.object(shape).strict().superRefine((values, ctx) => {
    const byId: Record<string, unknown> = {};
    for (const field of flattenFields(definition)) byId[field.id] = values[field.fieldName];
    for (const field of flattenFields(definition)) {
      const value = values[field.fieldName];
      if (!isFieldVisible(field, byId) || !isFieldEnabled(field, byId)) continue;
      const rules = field.rules;
      const required = isFieldRequired(field, byId);
      if (required && empty(value)) {
        ctx.addIssue({ code: 'custom', path: [field.fieldName], message: message(field, 'required', 'Este campo es obligatorio') });
        continue;
      }
      if (empty(value)) continue;
      if (field.type === 'number') {
        const numeric = typeof value === 'number' ? value : Number(value);
        if (!Number.isFinite(numeric)) {
          ctx.addIssue({ code: 'custom', path: [field.fieldName], message: message(field, 'type', 'Ingresá un número válido') });
        } else {
          if (rules.min !== undefined && numeric < rules.min) ctx.addIssue({ code: 'custom', path: [field.fieldName], message: message(field, 'min', `El valor mínimo es ${rules.min}`) });
          if (rules.max !== undefined && numeric > rules.max) ctx.addIssue({ code: 'custom', path: [field.fieldName], message: message(field, 'max', `El valor máximo es ${rules.max}`) });
        }
      }
      if (['text', 'textarea', 'date', 'time', 'select', 'radio', 'combobox'].includes(field.type) && typeof value !== 'string') {
        ctx.addIssue({ code: 'custom', path: [field.fieldName], message: message(field, 'type', 'Ingresá un valor válido') });
      }
      if (field.type === 'checkbox' && typeof value !== 'boolean') {
        ctx.addIssue({ code: 'custom', path: [field.fieldName], message: message(field, 'type', 'Marcá una opción válida') });
      }
      if (typeof value === 'string') {
        if (rules.minLength !== undefined && value.length < rules.minLength) ctx.addIssue({ code: 'custom', path: [field.fieldName], message: message(field, 'minLength', `Usá al menos ${rules.minLength} caracteres`) });
        if (rules.maxLength !== undefined && value.length > rules.maxLength) ctx.addIssue({ code: 'custom', path: [field.fieldName], message: message(field, 'maxLength', `Usá hasta ${rules.maxLength} caracteres`) });
        if (rules.pattern) {
          let matches = false;
          try { matches = new RegExp(rules.pattern).test(value); } catch { matches = false; }
          if (!matches) ctx.addIssue({ code: 'custom', path: [field.fieldName], message: message(field, 'pattern', 'El formato no es válido') });
        }
      }
    }
  });
}

export function validateSubmission(definition: FormDefinition, payload: Record<string, unknown>): ValidationResult {
  const parsed = buildSubmissionSchema(definition).safeParse(payload);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '_form');
      errors[key] ??= issue.message;
    }
    return { success: false, errors };
  }
  const data: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') data[key] = value;
  }
  return { success: true, data };
}
