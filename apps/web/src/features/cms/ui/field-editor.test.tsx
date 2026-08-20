import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { FieldType, FormDefinition, FormField } from '@tramites/form-contracts';
import { FIELD_TYPES, OPTION_FIELD_TYPES, READ_ONLY_BLOCKED_FIELD_TYPES, REPEATER_FIELD_TYPES } from '../model/constants';
import { collectDefinitionEditorErrors } from '../model/editor-validation';
import { ConditionEditor } from './condition-editor';
import { FieldEditor } from './field-editor';

const field = (overrides: Partial<FormField> = {}): FormField => ({
  id: 'f1',
  fieldName: 'campo',
  type: 'text',
  label: 'Campo',
  width: 'full',
  rules: {},
  ...overrides,
});

function definitionWith(target: FormField, kind: 'section' | 'repeater' = 'section'): FormDefinition {
  return {
    schemaVersion: 2,
    tipificationKey: 'generic@v1',
    title: 'Demo',
    submitLabel: 'Enviar',
    containers: [
      { id: 'c0', title: 'Otros', kind: 'section', columns: 1, fields: [field({ id: 'other', fieldName: 'otro', label: 'Otro campo' })] },
      { id: 'c1', title: 'Uno', kind, columns: 1, fieldName: kind === 'repeater' ? 'filas' : undefined, fields: [target] },
    ],
  };
}

function renderField(target: FormField, kind: 'section' | 'repeater' = 'section') {
  const definition = definitionWith(target, kind);
  return renderToStaticMarkup(
    <FieldEditor
      field={target}
      index={0}
      definition={definition}
      repeater={kind === 'repeater'}
      fieldErrors={collectDefinitionEditorErrors(definition, 'Demo').fields[target.id]}
      setDefinition={() => {}}
    />,
  );
}

/** Un campo del tipo pedido, ya con lo que ese tipo necesita para ser válido. */
function typedField(type: FieldType): FormField {
  const base = field({ type });
  if (OPTION_FIELD_TYPES.includes(type)) base.options = [{ label: 'A', value: 'a' }];
  if (type === 'combobox') base.allowCustomValue = false;
  return base;
}

describe('FieldEditor renderiza todos los tipos de campo', () => {
  it.each(FIELD_TYPES.map((type) => [type] as const))('%s se puede editar sin romperse', (type: FieldType) => {
    const markup = renderField(typedField(type));

    expect(markup).toContain('Etiqueta visible (Label)');
    expect(markup).toContain('Nombre de clave de payload');
    expect(markup).toContain('Obligatorio');
    // Los campos de catálogo muestran su editor de opciones; el resto no.
    expect(markup.includes('Opciones configuradas')).toBe(OPTION_FIELD_TYPES.includes(type));
    // Solo lectura está en todos menos donde el contrato lo prohíbe.
    expect(markup.includes('Solo lectura')).toBe(!READ_ONLY_BLOCKED_FIELD_TYPES.includes(type));
  });

  it.each(REPEATER_FIELD_TYPES.map((type) => [type] as const))(
    '%s también se puede editar como columna de grilla',
    (type: FieldType) => {
      const markup = renderField(typedField(type), 'repeater');

      expect(markup).toContain('Obligatorio');
      expect(markup).not.toContain('Visibilidad condicional');
    },
  );
});

describe('FieldEditor', () => {
  it('ofrece obligatoriedad y solo lectura también en las celdas de una grilla', () => {
    const markup = renderField(field(), 'repeater');

    expect(markup).toContain('Obligatorio');
    expect(markup).toContain('Solo lectura');
    expect(markup).not.toContain('Visibilidad condicional');
    expect(markup).toContain('Las celdas de una grilla no admiten lógica condicional');
  });

  it('no ofrece solo lectura en campos de archivos', () => {
    const markup = renderField(field({ type: 'fileUpload' }));

    expect(markup).toContain('Obligatorio');
    expect(markup).not.toContain('Solo lectura');
    expect(markup).toContain('Mínimo de archivos');
    expect(markup).toContain('Tipos de archivo permitidos');
    expect(markup).toContain('PDF');
    expect(markup).toContain('JPG');
    expect(markup).toContain('PNG');
  });

  it('muestra reglas de longitud en todos los campos de texto', () => {
    for (const type of ['text', 'textarea', 'email', 'phone', 'alphabetic', 'alphanumeric'] as const) {
      const markup = renderField(field({ type }));
      expect(markup, type).toContain('Mínimo de caracteres');
      expect(markup, type).toContain('Máximo de caracteres');
      expect(markup, type).toContain('Mensaje de error (máximo de caracteres)');
    }
    expect(renderField(field({ type: 'number' }))).not.toContain('Mínimo de caracteres');
  });

  it('muestra únicamente máscaras compatibles con el tipo de campo', () => {
    expect(renderField(field({ type: 'alphabetic' }))).not.toContain('DNI');
    expect(renderField(field({ type: 'phone' }))).toContain('Teléfono argentino');
    expect(renderField(field({ type: 'phone' }))).not.toContain('CUIT');
  });

  it('expone mensajes de error de formato y de tipo de dato', () => {
    const markup = renderField(field());

    expect(markup).toContain('Mensaje de error (formato inválido / regex)');
    expect(markup).toContain('Mensaje de error (tipo de dato incorrecto)');
  });

  it('elige el valor por defecto desde el catálogo en campos de opciones', () => {
    const markup = renderField(
      field({ type: 'select', options: [{ label: 'Robo', value: 'theft' }, { label: 'Choque', value: 'crash' }] }),
    );

    expect(markup).toContain('Sin valor inicial');
    expect(markup).toContain('<option value="theft">Robo</option>');
  });

  it('reporta junto al campo los errores detectados antes de guardar', () => {
    const markup = renderField(field({ rules: { pattern: '([a-z' } }));

    expect(markup).toContain('La expresión regular no es válida');
    expect(markup).toContain('has-error');
  });
});

describe('ConditionEditor', () => {
  const candidates = [field({ id: 'other', fieldName: 'otro', label: 'Otro campo' })];

  it('permite elegir la lógica y editar varias reglas', () => {
    const markup = renderToStaticMarkup(
      <ConditionEditor
        label="Visibilidad"
        condition={{
          logic: 'any',
          rules: [
            { fieldId: 'other', operator: 'greaterThan', value: 18 },
            { fieldId: 'other', operator: 'notEmpty' },
          ],
        }}
        otherFields={candidates}
        onChange={() => {}}
      />,
    );

    expect(markup).toContain('todas las reglas (Y)');
    expect(markup).toContain('al menos una regla (O)');
    expect(markup.match(/Depende del campo/g)).toHaveLength(2);
    expect(markup).toContain('es mayor que');
    expect(markup).toContain('está incluido en');
    expect(markup).toContain('+ Agregar regla');
  });

  it('ofrece un selector múltiple para los operadores de inclusión', () => {
    const markup = renderToStaticMarkup(
      <ConditionEditor
        label="Visibilidad"
        condition={{ logic: 'all', rules: [{ fieldId: 'source', operator: 'in', value: ['si'] }] }}
        otherFields={[field({ id: 'source', fieldName: 'origen', label: 'Origen', type: 'select', options: [{ label: 'Sí', value: 'si' }, { label: 'No', value: 'no' }] })]}
        onChange={() => {}}
      />,
    );

    expect(markup).toContain('Valores aceptados');
    expect(markup).toContain('condition-value-list');
    expect(markup.match(/type="checkbox"/g)).toHaveLength(2);
  });
});
