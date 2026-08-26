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

  it('permite elegir entre 1 y 4 columnas', async () => {
    const editor = renderEditor();
    const select = within(containerBox(0)).getByText('Distribución en columnas').closest('.form-group')!.querySelector('select')!;

    expect(within(select).getAllByRole('option')).toHaveLength(4);

    await editor.user.selectOptions(select, '3');
    expect(editor.definition.containers[0]?.columns).toBe(3);

    await editor.user.selectOptions(select, '4');
    expect(editor.definition.containers[0]?.columns).toBe(4);
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
});

/** El bloque FAQ N-ésimo del editor, para acotar las consultas. */
function faqBox(index: number): HTMLElement {
  return document.querySelectorAll('.faq-blocks-list .field-editor')[index] as HTMLElement;
}

describe('bloques FAQ en el editor', () => {
  it('sin bloques FAQ, avisa que todavía no hay ninguno', () => {
    renderEditor();
    expect(screen.getByText(/Todavía no agregaste bloques FAQ/)).toBeTruthy();
  });

  it('agrega un bloque FAQ nuevo', async () => {
    const editor = renderEditor();
    await editor.user.click(screen.getByRole('button', { name: /Agregar Bloque FAQ/ }));

    expect(editor.definition.faqBlocks).toHaveLength(1);
    expect(editor.definition.faqBlocks?.[0]).toMatchObject({ answer: '', initiallyOpen: false });
  });

  it('edita pregunta, respuesta y el checkbox de abierto por defecto', async () => {
    const editor = renderEditor();
    await editor.user.click(screen.getByRole('button', { name: /Agregar Bloque FAQ/ }));
    const box = faqBox(0);

    const question = within(box).getByText('Pregunta / título').closest('.form-group')!.querySelector('input')!;
    await editor.user.clear(question);
    await editor.user.type(question, '¿Qué necesito?');

    const answer = within(box).getByText('Respuesta / contenido').closest('.form-group')!.querySelector('textarea')!;
    await editor.user.type(answer, 'El DNI.');

    await editor.user.click(within(box).getByRole('checkbox', { name: /Mostrar abierto por defecto/ }));

    expect(editor.definition.faqBlocks?.[0]).toMatchObject({
      question: '¿Qué necesito?',
      answer: 'El DNI.',
      initiallyOpen: true,
    });
  });

  it('una pregunta o respuesta vacía bloquea el guardado y lo muestra junto al bloque', async () => {
    const editor = renderEditor();
    await editor.user.click(screen.getByRole('button', { name: /Agregar Bloque FAQ/ }));

    expect(collectDefinitionEditorErrors(editor.definition, 'Demo').hasErrors).toBe(true);
    expect(within(faqBox(0)).getByText('La respuesta es obligatoria')).toBeTruthy();
  });

  it('reordena bloques FAQ y deshabilita el movimiento en los extremos', async () => {
    const editor = renderEditor();
    await editor.user.click(screen.getByRole('button', { name: /Agregar Bloque FAQ/ }));
    await editor.user.click(screen.getByRole('button', { name: /Agregar Bloque FAQ/ }));
    const [first, second] = editor.definition.faqBlocks!.map((block) => block.id);

    expect(within(faqBox(0)).getByTitle('Mover arriba')).toHaveProperty('disabled', true);
    expect(within(faqBox(1)).getByTitle('Mover abajo')).toHaveProperty('disabled', true);

    await editor.user.click(within(faqBox(1)).getByTitle('Mover arriba'));
    expect(editor.definition.faqBlocks?.map((block) => block.id)).toEqual([second, first]);
  });

  it('elimina un bloque FAQ', async () => {
    const editor = renderEditor();
    await editor.user.click(screen.getByRole('button', { name: /Agregar Bloque FAQ/ }));
    await editor.user.click(within(faqBox(0)).getByRole('button', { name: 'Eliminar' }));

    expect(editor.definition.faqBlocks).toEqual([]);
  });
});
