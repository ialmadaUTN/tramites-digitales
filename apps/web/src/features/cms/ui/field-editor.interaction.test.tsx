// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { FormDefinition, FormField } from '@tramites/form-contracts';
import { formDefinitionSchema } from '@tramites/form-contracts';
import { collectDefinitionEditorErrors } from '../model/editor-validation';
import { ConditionEditor } from './condition-editor';
import { FieldEditor } from './field-editor';

/**
 * Tests de interacción: qué **definición produce** el editor cuando alguien lo
 * usa. Es la única forma de detectar un handler mal cableado — un `onChange`
 * conectado al setter equivocado renderiza exactamente igual, así que un test
 * sobre el markup no lo ve.
 *
 * Los tests de estructura (qué controles se muestran para cada tipo de campo)
 * viven en `field-editor.test.tsx` y no necesitan DOM.
 */

afterEach(cleanup);

const field = (overrides: Partial<FormField> = {}): FormField => ({
  id: 'f1',
  fieldName: 'campo',
  type: 'text',
  label: 'Campo',
  width: 'full',
  rules: {},
  ...overrides,
});

function definitionWith(target: FormField, kind: 'section' | 'repeater'): FormDefinition {
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

/**
 * Renderiza el editor con estado real y expone la definición viva, para poder
 * afirmar sobre lo que quedaría guardado después de cada interacción.
 */
function renderEditor(target: FormField, kind: 'section' | 'repeater' = 'section') {
  let current = definitionWith(target, kind);

  function Harness() {
    const [definition, setDefinition] = useState(current);
    current = definition;
    const live = definition.containers.flatMap((container) => container.fields).find((entry) => entry.id === target.id)!;
    return (
      <FieldEditor
        field={live}
        index={0}
        definition={definition}
        repeater={kind === 'repeater'}
        fieldErrors={collectDefinitionEditorErrors(definition, 'Demo').fields[target.id]}
        setDefinition={setDefinition}
      />
    );
  }

  render(<Harness />);
  return {
    user: userEvent.setup(),
    get field(): FormField {
      return current.containers.flatMap((container) => container.fields).find((entry) => entry.id === target.id)!;
    },
    get definition(): FormDefinition {
      return current;
    },
  };
}

/**
 * Los `<label>` del CMS no están asociados a su control (sin `htmlFor`), así
 * que `getByLabelText` no sirve para los campos del formulario. Buscamos el
 * control dentro del mismo `.form-group` que la etiqueta.
 */
function control(labelText: string | RegExp): HTMLElement {
  const label = screen.getAllByText(labelText)[0]!;
  const group = label.closest('.form-group') ?? label.parentElement!;
  const found = group.querySelector('select, input, textarea');
  if (!found) throw new Error(`No hay control junto a la etiqueta ${String(labelText)}`);
  return found as HTMLElement;
}

describe('FieldEditor — qué definición produce', () => {
  it('marcar "Solo lectura" deja el campo en solo lectura y desmarcarlo borra la clave', async () => {
    const editor = renderEditor(field());

    await editor.user.click(screen.getByLabelText('Solo lectura'));
    expect(editor.field.readOnly).toBe(true);

    await editor.user.click(screen.getByLabelText('Solo lectura'));
    expect('readOnly' in editor.field).toBe(false);
  });

  it('marcar "Obligatorio" en una celda de grilla llega a las reglas del campo', async () => {
    const editor = renderEditor(field(), 'repeater');

    await editor.user.click(screen.getByLabelText('Obligatorio'));
    expect(editor.field.rules.required).toBe(true);
    // La celda obligatoria tiene que seguir siendo una definición válida.
    expect(formDefinitionSchema.safeParse(editor.definition).success).toBe(true);
  });

  it('cambiar el tipo descarta la máscara incompatible en vez de arrastrarla', async () => {
    const editor = renderEditor(field({ maskKind: 'cuit_ar' }));
    expect(editor.field.maskKind).toBe('cuit_ar');

    await editor.user.selectOptions(control('Tipo de campo'), 'number');

    expect(editor.field.type).toBe('number');
    expect(editor.field.maskKind).toBeUndefined();
    expect(collectDefinitionEditorErrors(editor.definition, 'Demo').hasErrors).toBe(false);
  });

  it('cambiar el tipo descarta las reglas de longitud que el tipo nuevo no admite', async () => {
    const editor = renderEditor(field({ rules: { maxLength: 10 } }));

    await editor.user.selectOptions(control('Tipo de campo'), 'number');

    expect(editor.field.rules.maxLength).toBeUndefined();
  });

  it('el valor por defecto de un campo con catálogo se elige del catálogo', async () => {
    const editor = renderEditor(
      field({ type: 'select', options: [{ label: 'Robo', value: 'theft' }, { label: 'Choque', value: 'crash' }] }),
    );

    await editor.user.selectOptions(control('Valor inicial por defecto'), 'crash');
    expect(editor.field.defaultValue).toBe('crash');

    await editor.user.selectOptions(control('Valor inicial por defecto'), '');
    expect(editor.field.defaultValue).toBeUndefined();
  });

  it('el valor por defecto de un multiselect acumula y quita opciones', async () => {
    const editor = renderEditor(
      field({ type: 'multiselect', options: [{ label: 'Rojo', value: 'red' }, { label: 'Azul', value: 'blue' }] }),
    );

    await editor.user.click(screen.getByLabelText('Rojo'));
    await editor.user.click(screen.getByLabelText('Azul'));
    expect(editor.field.defaultValue).toEqual(['red', 'blue']);

    await editor.user.click(screen.getByLabelText('Rojo'));
    expect(editor.field.defaultValue).toEqual(['blue']);
  });

  it('escribir una regex inválida muestra el error sin esperar al guardado', async () => {
    const editor = renderEditor(field());

    // `type` trata `[` y `{` como sintaxis de teclas especiales: pegamos el texto crudo.
    await editor.user.click(control('Expresión regular (Regex)'));
    await editor.user.paste('([a-z');

    expect(editor.field.rules.pattern).toBe('([a-z');
    expect(screen.getByText('La expresión regular no es válida')).toBeTruthy();
  });

  it('un mensaje de error personalizado vacío no deja la clave colgando', async () => {
    const editor = renderEditor(field());
    const input = control('Mensaje de error personalizado (Obligatorio)');

    await editor.user.type(input, 'Falta');
    expect(editor.field.rules.errorMessages?.required).toBe('Falta');

    await editor.user.clear(input);
    expect(editor.field.rules.errorMessages).toBeUndefined();
  });

  it('activar la visibilidad condicional crea una condición válida contra otro campo', async () => {
    const editor = renderEditor(field());

    await editor.user.click(screen.getByLabelText('Visibilidad condicional'));

    expect(editor.field.conditions?.visible?.logic).toBe('all');
    expect(editor.field.conditions?.visible?.rules[0]?.fieldId).toBe('other');
  });
});

describe('ConditionEditor — qué condición produce', () => {
  const candidates = [
    field({ id: 'source', fieldName: 'origen', label: 'Origen', type: 'select', options: [{ label: 'Sí', value: 'si' }, { label: 'No', value: 'no' }] }),
  ];

  function renderCondition(initial: Parameters<typeof ConditionEditor>[0]['condition']) {
    let current = initial!;
    function Harness() {
      const [condition, setCondition] = useState(current);
      current = condition;
      return <ConditionEditor label="Visibilidad" condition={condition} otherFields={candidates} onChange={setCondition} />;
    }
    render(<Harness />);
    return { user: userEvent.setup(), get condition() { return current; } };
  }

  it('agrega y quita reglas, y nunca deja la condición sin ninguna', async () => {
    const editor = renderCondition({ logic: 'all', rules: [{ fieldId: 'source', operator: 'equals', value: 'si' }] });

    await editor.user.click(screen.getByRole('button', { name: '+ Agregar regla' }));
    expect(editor.condition.rules).toHaveLength(2);

    await editor.user.click(screen.getAllByRole('button', { name: 'Quitar regla' })[0]!);
    expect(editor.condition.rules).toHaveLength(1);

    // Con una sola regla, el botón queda deshabilitado: el contrato exige al menos una.
    expect(screen.getByRole('button', { name: 'Quitar regla' })).toHaveProperty('disabled', true);
  });

  it('cambia la lógica entre todas y al menos una', async () => {
    const editor = renderCondition({ logic: 'all', rules: [{ fieldId: 'source', operator: 'notEmpty' }] });

    const logicSelect = within(document.querySelector('.condition-editor-head')!).getByRole('combobox');
    await editor.user.selectOptions(logicSelect, 'any');
    expect(editor.condition.logic).toBe('any');
  });

  it('el operador de inclusión guarda una lista de valores del catálogo', async () => {
    const editor = renderCondition({ logic: 'all', rules: [{ fieldId: 'source', operator: 'equals', value: 'si' }] });

    const operatorSelect = within(document.querySelector('.condition-rule')!).getAllByRole('combobox')[1]!;
    await editor.user.selectOptions(operatorSelect, 'in');
    expect(editor.condition.rules[0]?.value).toEqual([]);

    await editor.user.click(screen.getByLabelText('Sí'));
    await editor.user.click(screen.getByLabelText('No'));
    expect(editor.condition.rules[0]?.value).toEqual(['si', 'no']);
  });

  it('cambiar de campo de origen limpia el valor esperado anterior', async () => {
    const editor = renderCondition({ logic: 'all', rules: [{ fieldId: 'source', operator: 'equals', value: 'si' }] });

    const fieldSelect = within(document.querySelector('.condition-rule')!).getAllByRole('combobox')[0]!;
    await editor.user.selectOptions(fieldSelect, 'source');

    expect(editor.condition.rules[0]?.value).toBe('');
  });
});
