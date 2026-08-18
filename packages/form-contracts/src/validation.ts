import { z } from 'zod';
import {
  flattenFields,
  FormContainer,
  FormDefinition,
  FormField,
  FormOption,
  FormValue,
  isFieldEnabled,
  isFieldRequired,
  isFieldVisible,
  isRepeaterValue,
  isUploadReference,
  maskKindSchema,
  repeaterContainers,
  uploadReferenceSchema,
  valuesEqual,
} from './index.js';

export type ValidationResult = { success: true; data: Record<string, FormValue> } | { success: false; errors: Record<string, string> };

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const DEFAULT_ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;

function empty(value: unknown): boolean {
  if (value === undefined || value === null || value === '' || value === false) return true;
  if (typeof value === 'string') return value.trim() === '';
  return Array.isArray(value) && value.length === 0;
}

function message(field: FormField, key: keyof NonNullable<FormField['rules']['errorMessages']>, fallback: string): string {
  return field.rules.errorMessages?.[key] || fallback;
}

export function normalizeMaskedValue(value: string, maskKind: FormField['maskKind']): string {
  if (!maskKind) return value;
  return value.replace(/\D/g, '');
}

export function normalizePhoneValue(value: string): string {
  return value.replace(/\D/g, '');
}

function formatOptionValue(value: unknown, options: FormOption[]): unknown {
  const match = options.find((option) => valuesEqual(option.value, value) || String(option.value) === String(value));
  return match?.value ?? value;
}

function isAllowedOption(value: unknown, options: FormOption[]): boolean {
  return options.some((option) => valuesEqual(option.value, value) || String(option.value) === String(value));
}

function validateMask(value: string, maskKind: FormField['maskKind']): string | undefined {
  if (!maskKindSchema.safeParse(maskKind).success || !maskKind) return undefined;
  const digits = normalizeMaskedValue(value, maskKind);
  switch (maskKind) {
    case 'phone_ar':
      if (digits.length < 8 || digits.length > 15) return 'Ingresá un teléfono válido';
      break;
    case 'dni_ar':
      if (![7, 8].includes(digits.length)) return 'Ingresá un DNI válido';
      break;
    case 'cuit_ar':
      if (digits.length !== 11) return 'Ingresá un CUIT válido';
      break;
    case 'cbu':
      if (digits.length !== 22) return 'Ingresá un CBU válido';
      break;
  }
  return undefined;
}

function validateStringType(field: FormField, value: unknown, ctx: z.RefinementCtx, path: (string | number)[]) {
  if (typeof value !== 'string') {
    ctx.addIssue({ code: 'custom', path, message: message(field, 'type', 'Ingresá un valor válido') });
    return;
  }

  const normalized = field.type === 'phone' ? normalizePhoneValue(value) : normalizeMaskedValue(value, field.maskKind);
  if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    ctx.addIssue({ code: 'custom', path, message: message(field, 'pattern', 'Ingresá un email válido') });
  }
  if (field.type === 'phone' && !/^[+0-9().\-\s]+$/.test(value)) {
    ctx.addIssue({ code: 'custom', path, message: message(field, 'pattern', 'Ingresá un teléfono válido') });
  }
  if (field.type === 'phone' && (normalized.length < 8 || normalized.length > 15)) {
    ctx.addIssue({ code: 'custom', path, message: message(field, 'pattern', 'Ingresá un teléfono válido') });
  }
  if (field.type === 'alphabetic' && !/^[\p{L}\s]+$/u.test(value)) {
    ctx.addIssue({ code: 'custom', path, message: message(field, 'pattern', 'Solo se permiten letras') });
  }
  if (field.type === 'alphanumeric' && !/^[\p{L}\p{N}\s]+$/u.test(value)) {
    ctx.addIssue({ code: 'custom', path, message: message(field, 'pattern', 'Solo se permiten letras y números') });
  }
  const maskError = validateMask(normalized, field.maskKind);
  if (maskError) ctx.addIssue({ code: 'custom', path, message: maskError });

  const rules = field.rules;
  if (rules.minLength !== undefined && normalized.length < rules.minLength) {
    ctx.addIssue({ code: 'custom', path, message: message(field, 'minLength', `Usá al menos ${rules.minLength} caracteres`) });
  }
  if (rules.maxLength !== undefined && normalized.length > rules.maxLength) {
    ctx.addIssue({ code: 'custom', path, message: message(field, 'maxLength', `Usá hasta ${rules.maxLength} caracteres`) });
  }
  if (rules.pattern) {
    let matches = false;
    try { matches = new RegExp(rules.pattern, 'u').test(normalized); } catch { matches = false; }
    if (!matches) ctx.addIssue({ code: 'custom', path, message: message(field, 'pattern', 'El formato no es válido') });
  }
}

function validateFileValue(field: FormField, value: unknown, ctx: z.RefinementCtx, path: (string | number)[]) {
  if (!Array.isArray(value)) {
    ctx.addIssue({ code: 'custom', path, message: message(field, 'type', 'Subí al menos un archivo válido') });
    return;
  }
  const minFiles = field.minFiles ?? (field.rules.required ? 1 : 0);
  const maxFiles = field.maxFiles ?? 5;
  if (value.length < minFiles) ctx.addIssue({ code: 'custom', path, message: `Subí al menos ${minFiles} archivo(s)` });
  if (value.length > maxFiles) ctx.addIssue({ code: 'custom', path, message: `Podés subir hasta ${maxFiles} archivo(s)` });
  const allowed = field.allowedMimeTypes ?? [...DEFAULT_ALLOWED_MIME_TYPES];
  value.forEach((item, index) => {
    const parsed = uploadReferenceSchema.safeParse(item);
    if (!parsed.success || !isUploadReference(item)) {
      ctx.addIssue({ code: 'custom', path: [...path, index], message: 'La referencia del archivo no es válida' });
      return;
    }
    if (!allowed.includes(item.contentType) || item.size > MAX_FILE_SIZE) {
      ctx.addIssue({ code: 'custom', path: [...path, index], message: 'El archivo no cumple el tipo o tamaño permitido' });
    }
  });
}

function validateFieldValue(field: FormField, value: unknown, ctx: z.RefinementCtx, path: (string | number)[]) {
  const fieldMessage = message(field, 'type', 'Ingresá un valor válido');
  switch (field.type) {
    case 'text':
    case 'email':
    case 'phone':
    case 'alphabetic':
    case 'alphanumeric':
    case 'textarea':
    case 'date':
    case 'time':
      validateStringType(field, value, ctx, path);
      return;
    case 'number': {
      const numeric = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(numeric)) {
        ctx.addIssue({ code: 'custom', path, message: fieldMessage });
      } else {
        if (field.rules.min !== undefined && numeric < field.rules.min) ctx.addIssue({ code: 'custom', path, message: message(field, 'min', `El valor mínimo es ${field.rules.min}`) });
        if (field.rules.max !== undefined && numeric > field.rules.max) ctx.addIssue({ code: 'custom', path, message: message(field, 'max', `El valor máximo es ${field.rules.max}`) });
      }
      return;
    }
    case 'checkbox':
      if (typeof value !== 'boolean') ctx.addIssue({ code: 'custom', path, message: message(field, 'type', 'Marcá una opción válida') });
      return;
    case 'select':
    case 'radio':
      if (!isAllowedOption(value, field.options ?? [])) ctx.addIssue({ code: 'custom', path, message: 'Seleccioná una opción válida' });
      return;
    case 'combobox':
      if (typeof value !== 'string' && typeof value !== 'number') {
        ctx.addIssue({ code: 'custom', path, message: fieldMessage });
      } else if (field.allowCustomValue === false && !isAllowedOption(value, field.options ?? [])) {
        ctx.addIssue({ code: 'custom', path, message: 'Seleccioná una opción del listado' });
      }
      return;
    case 'multiselect':
      if (!Array.isArray(value) || !value.every((item) => isAllowedOption(item, field.options ?? []))) {
        ctx.addIssue({ code: 'custom', path, message: 'Seleccioná opciones válidas' });
      }
      return;
    case 'fileUpload':
      validateFileValue(field, value, ctx, path);
      return;
  }
}

function validateRepeater(container: FormContainer, value: unknown, ctx: z.RefinementCtx) {
  const path = [container.fieldName ?? container.id];
  if (!Array.isArray(value) || !isRepeaterValue(value)) {
    ctx.addIssue({ code: 'custom', path, message: 'La grilla debe contener filas válidas' });
    return;
  }
  const minRows = container.minRows ?? 0;
  const maxRows = container.maxRows ?? 50;
  if (value.length < minRows) ctx.addIssue({ code: 'custom', path, message: `Agregá al menos ${minRows} fila(s)` });
  if (value.length > maxRows) ctx.addIssue({ code: 'custom', path, message: `Podés agregar hasta ${maxRows} fila(s)` });
  value.forEach((row, rowIndex) => {
    container.fields.forEach((field) => {
      const fieldValue = row[field.fieldName];
      const fieldPath = [...path, rowIndex, field.fieldName];
      if (field.rules.required && empty(fieldValue)) {
        ctx.addIssue({ code: 'custom', path: fieldPath, message: message(field, 'required', 'Este campo es obligatorio') });
        return;
      }
      if (!empty(fieldValue)) validateFieldValue(field, fieldValue, ctx, fieldPath);
    });
  });
}

export function buildSubmissionSchema(definition: FormDefinition) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of flattenFields(definition)) shape[field.fieldName] = z.unknown().optional();
  for (const container of repeaterContainers(definition)) {
    if (container.fieldName) shape[container.fieldName] = z.unknown().optional();
  }
  return z.object(shape).strict().superRefine((values, ctx) => {
    const byId: Record<string, unknown> = {};
    for (const field of flattenFields(definition)) byId[field.id] = values[field.fieldName];
    for (const field of flattenFields(definition)) {
      const value = values[field.fieldName];
      if (!isFieldVisible(field, byId) || !isFieldEnabled(field, byId)) continue;
      if (isFieldRequired(field, byId) && empty(value)) {
        ctx.addIssue({ code: 'custom', path: [field.fieldName], message: message(field, 'required', 'Este campo es obligatorio') });
        continue;
      }
      if (!empty(value)) validateFieldValue(field, value, ctx, [field.fieldName]);
    }
    for (const container of repeaterContainers(definition)) {
      if (container.fieldName && values[container.fieldName] !== undefined && !empty(values[container.fieldName])) {
        validateRepeater(container, values[container.fieldName], ctx);
      } else if (container.minRows && container.minRows > 0) {
        ctx.addIssue({ code: 'custom', path: [container.fieldName ?? container.id], message: `Agregá al menos ${container.minRows} fila(s)` });
      }
    }
  });
}

function normalizeFieldValue(field: FormField, value: unknown): FormValue | undefined {
  if (value === undefined || value === null) return undefined;
  if (['text', 'email', 'phone', 'alphabetic', 'alphanumeric', 'textarea', 'date', 'time'].includes(field.type) && typeof value === 'string') {
    return field.type === 'phone' ? normalizePhoneValue(value) : normalizeMaskedValue(value, field.maskKind);
  }
  if (field.type === 'number') {
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : undefined;
  }
  if (['select', 'radio', 'combobox'].includes(field.type)) return formatOptionValue(value, field.options ?? []) as FormValue;
  if (field.type === 'multiselect' && Array.isArray(value)) return value.map((item) => formatOptionValue(item, field.options ?? [])) as FormValue;
  if (field.type === 'checkbox' && typeof value === 'boolean') return value;
  if (field.type === 'fileUpload' && Array.isArray(value)) return value as FormValue;
  return undefined;
}

function normalizeRepeaterValue(container: FormContainer, value: unknown): FormValue | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((row) => {
    const normalized: Record<string, string | number | boolean> = {};
    for (const field of container.fields) {
      const fieldValue = normalizeFieldValue(field, row[field.fieldName]);
      if (fieldValue !== undefined && !Array.isArray(fieldValue)) normalized[field.fieldName] = fieldValue;
    }
    return normalized;
  });
}

export function validateSubmission(definition: FormDefinition, payload: Record<string, unknown>): ValidationResult {
  const parsed = buildSubmissionSchema(definition).safeParse(payload);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.length > 0 ? issue.path.join('.') : '_form';
      errors[key] ??= issue.message;
    }
    return { success: false, errors };
  }
  const data: Record<string, FormValue> = {};
  for (const field of flattenFields(definition)) {
    const normalized = normalizeFieldValue(field, parsed.data[field.fieldName]);
    if (normalized !== undefined) data[field.fieldName] = normalized;
  }
  for (const container of repeaterContainers(definition)) {
    if (!container.fieldName) continue;
    const normalized = normalizeRepeaterValue(container, parsed.data[container.fieldName]);
    if (normalized !== undefined) data[container.fieldName] = normalized;
  }
  return { success: true, data };
}
