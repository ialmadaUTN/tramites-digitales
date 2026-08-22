// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { FormDefinition } from '@tramites/form-contracts';
import { formDefinitionSchema } from '@tramites/form-contracts';
import { INITIAL_DEFINITION } from '../model/constants';
import { collectDefinitionEditorErrors } from '../model/editor-validation';
import { DefinitionEditor } from './definition-editor';

/**
 * El editor de estructura decide qué contenedores y grillas existen. Los tests
 * afirman sobre la definición resultante, que es lo que termina guardado.
 */

afterEach(cleanup);

function renderEditor(initial: FormDefinition = structuredClone(INITIAL_DEFINITION)) {
  let current = initial;

  function Harness() {
    const [definition, setDefinition] = useState(current);
    current = definition;
    return (
      <DefinitionEditor
        definition={definition}
        editorErrors={collectDefinitionEditorErrors(definition, 'Demo')}
        setDefinition={setDefinition}
      />
    );
  }

  render(<Harness />);
  return {
    user: userEvent.setup(),
    get definition() {
      return current;
    },
  };
}

function definitionWithRepeater(): FormDefinition {
  const definition = structuredClone(INITIAL_DEFINITION);
  return {
    ...definition,
    containers: [
      ...definition.containers,
      {
        id: 'repeater-1',
        title: 'Filas existentes',
        kind: 'repeater',
        fieldName: 'rows',
        columns: 1,
        minRows: 0,
        maxRows: 10,
        fields: [],
      },
    ],
  };
}

/** El contenedor N-ésimo del editor, para acotar las consultas. */
function containerBox(index: number): HTMLElement {
  return document.querySelectorAll('.container-editor')[index] as HTMLElement;
}

describe('DefinitionEditor', () => {
  it('no ofrece crear una grilla repetible nueva', () => {
    renderEditor();

    expect(screen.queryByRole('button', { name: /Nueva Grilla Repetible/ })).toBeNull();
  });

  it('agrega un contenedor nuevo al final', async () => {
    const editor = renderEditor();
    const before = editor.definition.containers.length;

    await editor.user.click(screen.getByRole('button', { name: /Nuevo Contenedor/ }));

    expect(editor.definition.containers).toHaveLength(before + 1);
    expect(editor.definition.containers.at(-1)?.kind).toBe('section');
  });

  it('una grilla existente muestra sus propios controles de fila', () => {
    renderEditor(definitionWithRepeater());
    const grid = containerBox(1);
    expect(within(grid).getByText('Clave de payload de la grilla')).toBeTruthy();
    expect(within(grid).getByText('Mínimo de filas')).toBeTruthy();
    expect(within(grid).getByText('Máximo de filas')).toBeTruthy();
    // Una grilla sin columnas todavía no se puede guardar, y lo dice.
    expect(within(grid).getByText(/al menos una columna/)).toBeTruthy();
  });

  it('agregar una columna a una grilla existente la vuelve una definición válida', async () => {
    const editor = renderEditor(definitionWithRepeater());
    await editor.user.click(within(containerBox(1)).getByRole('button', { name: /Agregar Campo/ }));

    expect(editor.definition.containers.at(-1)?.fields).toHaveLength(1);
    expect(collectDefinitionEditorErrors(editor.definition, 'Demo').hasErrors).toBe(false);
    expect(formDefinitionSchema.safeParse(editor.definition).success).toBe(true);
  });

  it('un mínimo de filas mayor al máximo se reporta en el acto en una grilla existente', async () => {
    const editor = renderEditor(definitionWithRepeater());
    const grid = containerBox(1);
    const minRows = within(grid).getByText('Mínimo de filas').closest('.form-group')!.querySelector('input')!;

    await editor.user.clear(minRows);
    await editor.user.type(minRows, '20');

    expect(editor.definition.containers.at(-1)?.minRows).toBe(20);
    expect(within(containerBox(1)).getByText(/no puede superar el máximo/)).toBeTruthy();
  });

  it('elimina un contenedor y su contenido', async () => {
    const editor = renderEditor();
    await editor.user.click(screen.getByRole('button', { name: /Nuevo Contenedor/ }));
    expect(editor.definition.containers).toHaveLength(2);

    await editor.user.click(within(containerBox(1)).getByRole('button', { name: 'Eliminar Contenedor' }));

    expect(editor.definition.containers).toHaveLength(1);
  });

  it('reordena contenedores y deshabilita el movimiento en los extremos', async () => {
    const editor = renderEditor();
    await editor.user.click(screen.getByRole('button', { name: /Nuevo Contenedor/ }));
    const [first, second] = editor.definition.containers.map((container) => container.id);

    // Acotado al encabezado: los campos de adentro tienen sus propias flechas.
    const head = (index: number) => within(containerBox(index).querySelector('.container-head') as HTMLElement);

    // El primero no puede subir ni el último bajar.
    expect(head(0).getByTitle('Mover arriba')).toHaveProperty('disabled', true);
    expect(head(1).getByTitle('Mover abajo')).toHaveProperty('disabled', true);

    await editor.user.click(head(1).getByTitle('Mover arriba'));
    expect(editor.definition.containers.map((container) => container.id)).toEqual([second, first]);
  });

  it('un contenedor sin título bloquea el guardado y lo muestra junto al campo', async () => {
    const editor = renderEditor();
    const title = within(containerBox(0)).getByText('Título del contenedor / sección').closest('.form-group')!.querySelector('input')!;

    await editor.user.clear(title);

    expect(collectDefinitionEditorErrors(editor.definition, 'Demo').hasErrors).toBe(true);
    expect(within(containerBox(0)).getByText('El título del contenedor es obligatorio')).toBeTruthy();
  });

  it('sin contenedores ofrece crear el primero', async () => {
    const editor = renderEditor({ ...structuredClone(INITIAL_DEFINITION), containers: [] });

    expect(screen.getByText(/no tiene contenedores aún/)).toBeTruthy();
    await editor.user.click(screen.getByRole('button', { name: /Agregar primer contenedor/ }));
    expect(editor.definition.containers).toHaveLength(1);
  });

  it('permite declarar una variable externa y agregar un bloque informativo', async () => {
    const editor = renderEditor();
    await editor.user.click(screen.getByRole('button', { name: /Agregar variable externa/ }));
    expect(editor.definition.externalVariables).toHaveLength(1);
    expect(screen.getByText(/variable1/).closest('.external-variable-row')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Agregar variable externa/ }).classList.contains('external-variable-add')).toBe(true);
    await editor.user.click(within(containerBox(0)).getByRole('button', { name: /Agregar bloque informativo/ }));
    expect(editor.definition.containers[0]?.items?.some((item) => item.kind === 'textBlock')).toBe(true);
    expect(screen.getByText('Bloque informativo')).toBeTruthy();
  });

  it('edita el tipo/confianza y condiciona el bloque con una variable externa', async () => {
    const editor = renderEditor();
    await editor.user.click(screen.getByRole('button', { name: /Agregar variable externa/ }));
    const variableRow = screen.getByText(/variable1/).closest('.form-group') as HTMLElement;
    await editor.user.selectOptions(within(variableRow).getByText('Tipo').parentElement!.querySelector('select') as HTMLSelectElement, 'number');
    await editor.user.selectOptions(within(variableRow).getByText('Confianza').parentElement!.querySelector('select') as HTMLSelectElement, 'trusted');
    await editor.user.click(within(containerBox(0)).getByRole('button', { name: /Agregar bloque informativo/ }));

    const block = screen.getByText('Bloque informativo').closest('.field-editor') as HTMLElement;
    const title = within(block).getByText('Título').closest('.form-group')!.querySelector('input') as HTMLInputElement;
    const body = within(block).getByText('Texto').closest('.form-group')!.querySelector('textarea') as HTMLTextAreaElement;
    await editor.user.clear(title);
    await editor.user.type(title, 'Ayuda');
    await editor.user.clear(body);
    await editor.user.type(body, 'Contenido contextual');
    await editor.user.click(within(block).getByLabelText('Visibilidad condicional'));
    const source = within(block).getByText('Depende del campo').closest('.form-group')!.querySelector('select') as HTMLSelectElement;
    await editor.user.selectOptions(source, 'external:variable1');

    const item = editor.definition.containers[0]?.items?.find((candidate) => candidate.kind === 'textBlock');
    expect(editor.definition.externalVariables?.[0]).toMatchObject({ type: 'number', trust: 'trusted' });
    expect(item).toMatchObject({ title: 'Ayuda', text: 'Contenido contextual', conditions: { visible: { rules: [{ source: { kind: 'external', variable: 'variable1' } }] } } });
  });
});
