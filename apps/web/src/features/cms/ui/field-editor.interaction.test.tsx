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

async function addConfiguration(user: ReturnType<typeof userEvent.setup>, label: string | RegExp) {
  await user.click(screen.getByRole('button', { name: /Agregar configuración/ }));
  await user.click(screen.getByRole('menuitem', { name: typeof label === 'string' ? new RegExp(label) : label }));
}

describe('FieldEditor — qué definición produce', () => {
  it('filtra el menú según el tipo y el contexto del campo', async () => {
    renderEditor(field({ type: 'fileUpload' }));
    await screen.getByRole('button', { name: /Agregar configuración/ }).click();
    expect(screen.queryByRole('menuitem', { name: /Solo lectura/ })).toBeNull();
    expect(screen.getByRole('menuitem', { name: /Reglas de archivos/ })).toBeTruthy();

    cleanup();
    renderEditor(field(), 'repeater');
    await screen.getByRole('button', { name: /Agregar configuración/ }).click();
    expect(screen.queryByRole('menuitem', { name: /Lógica condicional/ })).toBeNull();
  });

  it('edita presentación, distribución y límites desde tarjetas independientes', async () => {
    const editor = renderEditor(field());

    await addConfiguration(editor.user, 'Textos de ayuda');
    await editor.user.type(control('Texto borrador (Placeholder)'), 'Ingresá tu dato');
    await editor.user.type(control('Texto de ayuda (Help text)'), 'Lo encontrás en la credencial');
    expect(editor.field.placeholder).toBe('Ingresá tu dato');
    expect(editor.field.helpText).toBe('Lo encontrás en la credencial');

    await addConfiguration(editor.user, 'Distribución');
    await editor.user.selectOptions(control('Ancho en pantalla'), 'half');
    expect(editor.field.width).toBe('half');

    await addConfiguration(editor.user, 'Límites');
    await editor.user.type(control('Mínimo de caracteres'), '2');
    await editor.user.type(control('Máximo de caracteres'), '40');
    expect(editor.field.rules.minLength).toBe(2);
    expect(editor.field.rules.maxLength).toBe(40);
  });

  it('elige valores iniciales para campos libres y casillas', async () => {
    const numberEditor = renderEditor(field({ type: 'number' }));
    await addConfiguration(numberEditor.user, 'Valor inicial');
    await numberEditor.user.type(control('Valor inicial por defecto'), '42');
    expect(numberEditor.field.defaultValue).toBe(42);

    cleanup();
    const checkboxEditor = renderEditor(field({ type: 'checkbox' }));
    await addConfiguration(checkboxEditor.user, 'Valor inicial');
    await checkboxEditor.user.selectOptions(control('Valor inicial por defecto'), 'true');
    expect(checkboxEditor.field.defaultValue).toBe(true);
  });

  it('edita restricciones de archivos y conserva al menos un tipo permitido', async () => {
    const editor = renderEditor(field({ type: 'fileUpload', minFiles: 1, maxFiles: 2, allowedMimeTypes: ['application/pdf'] }));
    const filesHeading = screen.getByText('Reglas de archivos', { exact: true });
    const filesCard = filesHeading.closest('.configuration-card');
    if (!filesCard) throw new Error('No se encontró la tarjeta de archivos');
    await editor.user.click(filesCard.querySelector('.configuration-card-trigger')!);

    const min = control('Mínimo de archivos');
    await editor.user.clear(min);
    await editor.user.type(min, '2');
    const max = control('Máximo de archivos');
    await editor.user.clear(max);
    await editor.user.type(max, '4');
    expect(editor.field.minFiles).toBe(2);
    expect(editor.field.maxFiles).toBe(4);

    await editor.user.click(screen.getByLabelText('PDF'));
    expect(editor.field.allowedMimeTypes).toEqual(['application/pdf']);
    await editor.user.click(screen.getByLabelText('JPG'));
    await editor.user.click(screen.getByLabelText('PNG'));
    expect(editor.field.allowedMimeTypes).toBeUndefined();
  });

  it('permite editar opciones automáticas y alternar la vista masiva', async () => {
    const editor = renderEditor(field({ type: 'select', options: [] }));

    const optionsCard = screen.getByText('Opciones del catálogo', { exact: true }).closest('.configuration-card');
    if (!optionsCard) throw new Error('No se encontró la tarjeta de catálogo');
    const optionsEditor = within(optionsCard as HTMLElement);
    await optionsEditor.getByRole('button', { name: '+ Agregar primera opción' }).click();
    const firstInput = optionsCard.querySelector('.option-input') as HTMLInputElement | null;
    if (!firstInput) throw new Error('No se encontró la primera opción');
    await editor.user.clear(firstInput);
    await editor.user.type(firstInput, 'Sí');
    expect(editor.field.options?.[0]).toMatchObject({ label: 'Sí', value: 'si' });

    await optionsEditor.getByRole('button', { name: 'Texto masivo' }).click();
    const raw = optionsCard.querySelector('.options-textarea') as HTMLTextAreaElement;
    await editor.user.clear(raw);
    await editor.user.type(raw, 'si|Sí\nno|No');
    expect(editor.field.options).toEqual([{ value: 'si', label: 'Sí' }, { value: 'no', label: 'No' }]);
    await optionsEditor.getByRole('button', { name: 'Visual' }).click();
    expect(optionsCard.textContent).toContain('Opciones configuradas');
  });

  it('mantiene las tarjetas plegadas y quitar una configuración limpia sus valores', async () => {
    const editor = renderEditor(field({ placeholder: 'Ayuda breve' }));
    const heading = screen.getByText('Textos de ayuda', { exact: true });
    const card = heading.closest('.configuration-card');
    if (!card) throw new Error('No se encontró la tarjeta de textos de ayuda');
    const trigger = card.querySelector('.configuration-card-trigger');
    if (!trigger) throw new Error('No se encontró el disparador de textos de ayuda');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    await editor.user.click(trigger);
    expect(screen.getByDisplayValue('Ayuda breve')).toBeTruthy();
    await editor.user.click(screen.getByRole('button', { name: 'Quitar configuración: Textos de ayuda' }));

    expect(editor.field.placeholder).toBeUndefined();
    expect(screen.queryByText('Textos de ayuda', { exact: true })).toBeNull();
  });

  it('abre automáticamente la tarjeta que contiene un error de definición', () => {
    renderEditor(field({ rules: { pattern: '([a-z' } }));

    const heading = screen.getByText('Expresión regular', { exact: true });
    const card = heading.closest('.configuration-card');
    if (!card) throw new Error('No se encontró la tarjeta de expresión regular');
    const trigger = card.querySelector('.configuration-card-trigger');
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('La expresión regular no es válida')).toBeTruthy();
  });

  it('marcar "Solo lectura" deja el campo en solo lectura y desmarcarlo borra la clave', async () => {
    const editor = renderEditor(field());

    await addConfiguration(editor.user, 'Solo lectura');
    await editor.user.click(screen.getByLabelText('Solo lectura'));
    expect(editor.field.readOnly).toBe(true);

    await editor.user.click(screen.getByLabelText('Solo lectura'));
    expect('readOnly' in editor.field).toBe(false);
  });

  it('marcar "Obligatorio" en una celda de grilla llega a las reglas del campo', async () => {
    const editor = renderEditor(field(), 'repeater');

    await addConfiguration(editor.user, 'Obligatoriedad');
    await editor.user.click(screen.getByLabelText('Obligatorio'));
    expect(editor.field.rules.required).toBe(true);
    // La celda obligatoria tiene que seguir siendo una definición válida.
    expect(formDefinitionSchema.safeParse(editor.definition).success).toBe(true);
  });

  it('cambiar el tipo descarta la máscara incompatible en vez de arrastrarla', async () => {
    const editor = renderEditor(field({ maskKind: 'cuit_ar' }));
    expect(editor.field.maskKind).toBe('cuit_ar');

    const maskHeading = screen.getByText('Máscara', { exact: true });
    const maskCard = maskHeading.closest('.configuration-card');
    if (!maskCard) throw new Error('No se encontró la tarjeta de máscara');
    const maskTrigger = maskCard.querySelector('.configuration-card-trigger');
    if (!maskTrigger) throw new Error('No se encontró el disparador de máscara');
    await editor.user.click(maskTrigger);
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

    await addConfiguration(editor.user, 'Valor inicial');
    await editor.user.selectOptions(control('Valor inicial por defecto'), 'crash');
    expect(editor.field.defaultValue).toBe('crash');

    await editor.user.selectOptions(control('Valor inicial por defecto'), '');
    expect(editor.field.defaultValue).toBeUndefined();
  });

  it('el valor por defecto de un multiselect acumula y quita opciones', async () => {
    const editor = renderEditor(
      field({ type: 'multiselect', options: [{ label: 'Rojo', value: 'red' }, { label: 'Azul', value: 'blue' }] }),
    );

    await addConfiguration(editor.user, 'Valor inicial');
    await editor.user.click(screen.getByLabelText('Rojo'));
    await editor.user.click(screen.getByLabelText('Azul'));
    expect(editor.field.defaultValue).toEqual(['red', 'blue']);

    await editor.user.click(screen.getByLabelText('Rojo'));
    expect(editor.field.defaultValue).toEqual(['blue']);
  });

  it('escribir una regex inválida muestra el error sin esperar al guardado', async () => {
    const editor = renderEditor(field());

    await addConfiguration(editor.user, 'Expresión regular');
    // `type` trata `[` y `{` como sintaxis de teclas especiales: pegamos el texto crudo.
    await editor.user.click(control('Expresión regular (Regex)'));
    await editor.user.paste('([a-z');

    expect(editor.field.rules.pattern).toBe('([a-z');
    expect(screen.getByText('La expresión regular no es válida')).toBeTruthy();
  });

  it('un mensaje de error personalizado vacío no deja la clave colgando', async () => {
    const editor = renderEditor(field());
    await addConfiguration(editor.user, 'Mensajes de error');
    const input = control('Mensaje de error personalizado (Obligatorio)');

    await editor.user.type(input, 'Falta');
    expect(editor.field.rules.errorMessages?.required).toBe('Falta');

    await editor.user.clear(input);
    expect(editor.field.rules.errorMessages).toBeUndefined();
  });

  it('activar la visibilidad condicional crea una condición válida contra otro campo', async () => {
    const editor = renderEditor(field());

    await addConfiguration(editor.user, 'Lógica condicional');
    await editor.user.click(screen.getByLabelText('Visibilidad condicional'));

    expect(editor.field.conditions?.visible?.logic).toBe('all');
    expect(editor.field.conditions?.visible?.rules[0]?.source).toEqual({ kind: 'field', fieldId: 'other' });
  });
});

describe('ConditionEditor — qué condición produce', () => {
  const candidates = [
    field({ id: 'source', fieldName: 'origen', label: 'Origen', type: 'select', options: [{ label: 'Sí', value: 'si' }, { label: 'No', value: 'no' }] }),
  ];

  function renderCondition(initial: Parameters<typeof ConditionEditor>[0]['condition'], externalVariables: Parameters<typeof ConditionEditor>[0]['externalVariables'] = []) {
    let current = initial!;
    function Harness() {
      const [condition, setCondition] = useState(current);
      current = condition;
      return <ConditionEditor label="Visibilidad" condition={condition} otherFields={candidates} externalVariables={externalVariables} onChange={setCondition} />;
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

  it('selecciona una variable externa como origen', async () => {
    const editor = renderCondition({ logic: 'all', rules: [{ fieldId: 'source', operator: 'equals', value: 'si' }] }, [{ name: 'insuranceCode', label: 'Código de seguro', type: 'string', trust: 'trusted' }]);
    const fieldSelect = within(document.querySelector('.condition-rule')!).getAllByRole('combobox')[0]!;
    await editor.user.selectOptions(fieldSelect, 'external:insuranceCode');
    expect(editor.condition.rules[0]?.source).toEqual({ kind: 'external', variable: 'insuranceCode' });
    expect(editor.condition.rules[0]?.fieldId).toBeUndefined();
  });

  it('usa controles tipados para variables externas numéricas y booleanas', async () => {
    const numberEditor = renderCondition({ logic: 'all', rules: [{ fieldId: 'source', operator: 'equals', value: '' }] }, [{ name: 'count', label: 'Cantidad', type: 'number', trust: 'trusted' }]);
    await numberEditor.user.selectOptions(within(document.querySelector('.condition-rule')!).getAllByRole('combobox')[0]!, 'external:count');
    const numberInput = document.querySelector('.condition-rule input') as HTMLInputElement;
    await numberEditor.user.type(numberInput, '12');
    expect(numberEditor.condition.rules[0]?.value).toBe(12);
    cleanup();
    const booleanEditor = renderCondition({ logic: 'all', rules: [{ source: { kind: 'external', variable: 'active' }, operator: 'equals', value: '' }] }, [{ name: 'active', label: 'Activo', type: 'boolean', trust: 'trusted' }]);
    await booleanEditor.user.selectOptions(within(document.querySelector('.condition-rule')!).getAllByRole('combobox')[2]!, 'true');
    expect(booleanEditor.condition.rules[0]?.value).toBe(true);
  });

  it('agrega un grupo anidado y permite cambiar su lógica', async () => {
    const editor = renderCondition({ logic: 'all', rules: [{ fieldId: 'source', operator: 'notEmpty' }] });
    await editor.user.click(screen.getByRole('button', { name: '+ Agregar grupo anidado' }));
    expect(editor.condition.groups).toHaveLength(1);
    const nested = document.querySelectorAll('.condition-group-nested')[0] as HTMLElement;
    const logic = within(nested).getAllByRole('combobox')[0]!;
    await editor.user.selectOptions(logic, 'any');
    expect(editor.condition.groups?.[0]?.logic).toBe('any');
  });
});
