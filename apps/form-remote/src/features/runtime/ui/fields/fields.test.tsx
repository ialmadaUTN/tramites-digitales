// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { FieldType, FormField } from '@tramites/form-contracts';
import type { ControllerRenderProps } from 'react-hook-form';
import type { FormValues } from '../../../../shared/types/form-values';
import { commonInputProps, isInteractive } from './common-props';
import { getFieldRenderer } from './registry';

/**
 * Los renderers son la cara visible del contrato: si un campo de solo lectura
 * se puede editar, el `defaultValue` declarado deja de ser una garantía.
 *
 * `readOnly` del DOM no existe en select, checkbox, radio ni multiselect, así
 * que ahí el bloqueo tiene que llegar por `disabled`. Estos tests fijan esa
 * diferencia, que es fácil de romper sin darse cuenta.
 */

afterEach(cleanup);

const ALL_TYPES: FieldType[] = [
  'text', 'email', 'phone', 'alphabetic', 'alphanumeric', 'textarea',
  'number', 'date', 'time', 'checkbox', 'radio', 'select', 'combobox', 'multiselect',
];

const field = (overrides: Partial<FormField> = {}): FormField => ({
  id: 'f1',
  fieldName: 'campo',
  type: 'text',
  label: 'Campo',
  width: 'full',
  rules: {},
  ...overrides,
});

function controllerField(value: unknown = ''): ControllerRenderProps<FormValues> {
  return {
    name: 'campo',
    value,
    onChange: () => {},
    onBlur: () => {},
    ref: () => {},
    disabled: false,
  } as unknown as ControllerRenderProps<FormValues>;
}

function renderControl(target: FormField, value?: unknown) {
  const renderField = getFieldRenderer(target.type);
  const options = target.options ?? [{ label: 'A', value: 'a' }];
  render(renderField({ field: target, controllerField: controllerField(value), enabled: true, options }));
}

/** Todo control interactivo del árbol renderizado. */
function controls(): HTMLElement[] {
  return [...document.querySelectorAll('input, select, textarea')] as HTMLElement[];
}

describe('bloqueo de campos de solo lectura', () => {
  it.each(ALL_TYPES.map((type) => [type] as const))('%s de solo lectura no se puede editar', (type: FieldType) => {
    renderControl(field({ type, readOnly: true }), type === 'checkbox' ? false : '');

    const editable = controls().filter((element) => {
      const blocked = element.hasAttribute('disabled') || element.hasAttribute('readonly');
      return !blocked;
    });
    expect(editable, `${type} dejó controles editables`).toHaveLength(0);
  });

  it.each(ALL_TYPES.map((type) => [type] as const))('%s editable no queda bloqueado', (type: FieldType) => {
    renderControl(field({ type }), type === 'checkbox' ? false : '');

    const blocked = controls().filter((element) => element.hasAttribute('disabled') || element.hasAttribute('readonly'));
    expect(blocked, `${type} quedó bloqueado sin ser de solo lectura`).toHaveLength(0);
  });

  it('un campo deshabilitado por condición se bloquea aunque no sea de solo lectura', () => {
    const renderField = getFieldRenderer('text');
    render(renderField({ field: field(), controllerField: controllerField(''), enabled: false, options: [] }));

    expect(screen.getByRole('textbox')).toHaveProperty('disabled', true);
  });
});

describe('commonInputProps', () => {
  it('traduce el estado del campo a props del DOM', () => {
    const props = commonInputProps({
      field: field({ placeholder: 'Ej.', rules: { min: 1, max: 9 } }),
      controllerField: controllerField('hola'),
      enabled: true,
      options: [],
    });

    expect(props).toMatchObject({ id: 'f1', disabled: false, readOnly: false, placeholder: 'Ej.', value: 'hola', min: 1, max: 9 });
  });

  it('normaliza el valor para el input sin perder los números', () => {
    const value = (raw: unknown) => commonInputProps({ field: field(), controllerField: controllerField(raw), enabled: true, options: [] }).value;

    expect(value(12)).toBe(12);
    expect(value(0)).toBe(0);
    expect(value(undefined)).toBe('');
    expect(value(null)).toBe('');
    expect(value(true)).toBe('true');
    expect(value(Number.NaN)).toBe('NaN');
  });

  it('isInteractive combina habilitación y solo lectura', () => {
    expect(isInteractive({ field: field(), enabled: true })).toBe(true);
    expect(isInteractive({ field: field(), enabled: false })).toBe(false);
    expect(isInteractive({ field: field({ readOnly: true }), enabled: true })).toBe(false);
  });
});

describe('registry de renderers', () => {
  it('resuelve un renderer para cada tipo del contrato', () => {
    for (const type of [...ALL_TYPES, 'fileUpload' as const]) {
      expect(getFieldRenderer(type), type).toBeTypeOf('function');
    }
  });

  it('cae en el renderer de texto ante un tipo desconocido', () => {
    expect(getFieldRenderer('inexistente' as FieldType)).toBe(getFieldRenderer('text'));
  });
});

describe('renderizado por tipo', () => {
  it('el select muestra las opciones del catálogo y un placeholder', () => {
    renderControl(field({ type: 'select', options: [{ label: 'Robo', value: 'theft' }] }));

    expect(screen.getByRole('option', { name: 'Seleccioná una opción' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Robo' })).toBeTruthy();
  });

  it('el radio marca la opción que coincide con el valor', () => {
    renderControl(field({ type: 'radio', options: [{ label: 'Sí', value: 'si' }, { label: 'No', value: 'no' }] }), 'no');

    expect(screen.getByLabelText('No')).toHaveProperty('checked', true);
    expect(screen.getByLabelText('Sí')).toHaveProperty('checked', false);
  });

  it('el multiselect marca cada valor ya seleccionado', () => {
    renderControl(field({ type: 'multiselect', options: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }] }), ['b']);

    expect(screen.getByLabelText('B')).toHaveProperty('checked', true);
    expect(screen.getByLabelText('A')).toHaveProperty('checked', false);
  });

  it('el campo con máscara muestra el valor formateado', () => {
    renderControl(field({ maskKind: 'cuit_ar' }), '20123456783');
    expect(screen.getByRole('textbox')).toHaveProperty('value', '20-12345678-3');

    cleanup();
    renderControl(field({ maskKind: 'dni_ar' }), '12345678');
    expect(screen.getByRole('textbox')).toHaveProperty('value', '12.345.678');
  });
});
