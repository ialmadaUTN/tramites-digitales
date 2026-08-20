import type { FormField } from './index.js';

function empty(value: unknown): boolean {
  if (value === undefined || value === null || value === '' || value === false) return true;
  if (typeof value === 'string') return value.trim() === '';
  return Array.isArray(value) && value.length === 0;
}

function message(field: FormField, key: keyof NonNullable<FormField['rules']['errorMessages']>, fallback: string): string {
  return field.rules.errorMessages?.[key] || fallback;
}

function normalizeMaskedValue(value: string): string {
  return value.replace(/\D/g, '');
}

function isAllowedOption(value: unknown, field: FormField): boolean {
  return (field.options ?? []).some((option) => String(option.value).trim() === String(value).trim());
}

function maskError(value: string, field: FormField): string | undefined {
  if (!field.maskKind) return undefined;
  const digits = normalizeMaskedValue(value);
  if (field.maskKind === 'phone_ar' && (digits.length < 8 || digits.length > 15)) return 'Ingresá un teléfono válido';
  if (field.maskKind === 'dni_ar' && ![7, 8].includes(digits.length)) return 'Ingresá un DNI válido';
  if (field.maskKind === 'cuit_ar' && digits.length !== 11) return 'Ingresá un CUIT válido';
  if (field.maskKind === 'cbu' && digits.length !== 22) return 'Ingresá un CBU válido';
  return undefined;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value);
}

/**
 * Valida un valor inicial sin depender del módulo de runtime. Este módulo
 * solo usa imports de tipos relativos para poder ser consumido por Turbopack
 * desde el CMS y por Node/Vite desde los contratos.
 */
export function validateFieldDefaultValue(field: FormField): string | undefined {
  const value = field.defaultValue;
  if (value === undefined) return undefined;
  if (empty(value)) return field.rules.required ? message(field, 'required', 'Este campo es obligatorio') : undefined;

  if (field.type === 'fileUpload') return 'Los campos de archivos no admiten valor por defecto';

  if (field.type === 'multiselect') {
    if (!Array.isArray(value) || !value.every((item) => isAllowedOption(item, field))) return 'Seleccioná opciones válidas';
    return undefined;
  }
  if (Array.isArray(value)) return 'Solo la selección múltiple admite varios valores por defecto';

  if (field.type === 'number') {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) return message(field, 'type', 'El valor por defecto debe ser un número');
    if (field.rules.min !== undefined && numeric < field.rules.min) return message(field, 'min', `El valor mínimo es ${field.rules.min}`);
    if (field.rules.max !== undefined && numeric > field.rules.max) return message(field, 'max', `El valor máximo es ${field.rules.max}`);
    return undefined;
  }
  if (field.type === 'checkbox') {
    return typeof value === 'boolean' ? undefined : message(field, 'type', 'El valor por defecto debe ser true o false');
  }
  if (field.type === 'select' || field.type === 'radio') {
    return isAllowedOption(value, field) ? undefined : 'Seleccioná una opción válida';
  }
  if (field.type === 'combobox') {
    if (typeof value !== 'string' && typeof value !== 'number') return message(field, 'type', 'Ingresá un valor válido');
    if (field.allowCustomValue === false && !isAllowedOption(value, field)) return 'Seleccioná una opción del listado';
    return undefined;
  }
  if (typeof value !== 'string') return message(field, 'type', 'Ingresá un valor válido');

  const normalized = field.type === 'phone' || field.maskKind ? normalizeMaskedValue(value) : value;
  if (field.type === 'email' && !/^\S+@\S+\.\S+$/.test(value)) return message(field, 'pattern', 'Ingresá un email válido');
  if (field.type === 'phone' && (!/^[+0-9().\-\s]+$/.test(value) || normalized.length < 8 || normalized.length > 15)) {
    return message(field, 'pattern', 'Ingresá un teléfono válido');
  }
  if (field.type === 'alphabetic' && !/^[\p{L}\s]+$/u.test(value)) return message(field, 'pattern', 'Solo se permiten letras');
  if (field.type === 'alphanumeric' && !/^[\p{L}\p{N}\s]+$/u.test(value)) return message(field, 'pattern', 'Solo se permiten letras y números');
  if (field.type === 'date' && !validDate(value)) return message(field, 'pattern', 'Ingresá una fecha válida');
  if (field.type === 'time' && !validTime(value)) return message(field, 'pattern', 'Ingresá un horario válido');

  const maskValidation = maskError(normalized, field);
  if (maskValidation) return maskValidation;
  if (field.rules.minLength !== undefined && normalized.length < field.rules.minLength) {
    return message(field, 'minLength', `Usá al menos ${field.rules.minLength} caracteres`);
  }
  if (field.rules.maxLength !== undefined && normalized.length > field.rules.maxLength) {
    return message(field, 'maxLength', `Usá hasta ${field.rules.maxLength} caracteres`);
  }
  if (field.rules.pattern) {
    try {
      if (!new RegExp(field.rules.pattern, 'u').test(normalized)) return message(field, 'pattern', 'El formato no es válido');
    } catch {
      return 'La expresión regular no es válida';
    }
  }
  return undefined;
}
