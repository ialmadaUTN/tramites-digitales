// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { FormDefinition, FormField } from '@tramites/form-contracts';
import { formDefinitionSchema } from '@tramites/form-contracts';
import { collectDefinitionEditorErrors } from '../model/editor-validation';
import { FieldEditor } from './field-editor';

/**
 * Interacción sobre la obligatoriedad: qué ofrece el editor y qué definición
 * produce. Un checkbox deshabilitado en el markup pero cableado igual seguiría
 * dejando guardar la combinación ambigua, así que se afirma sobre la definición.
 */

afterEach(cleanup);

const gate: FormField = { id: 'gate', fieldName: 'gate', type: 'text', label: 'Gate', width: 'full', rules: {} };
const pointsAtGate = { logic: 'all' as const, rules: [{ fieldId: 'gate', operator: 'notEmpty' as const }] };

function definitionWith(target: Partial<FormField>): FormDefinition {
  return {
    schemaVersion: 2,
    tipificationKey: 'generic@v1',
    title: 'Demo',
    submitLabel: 'Enviar',
    containers: [{
      id: 'c1',
      title: 'Uno',
      kind: 'section',
      columns: 1,
      fields: [gate, { id: 'f1', fieldName: 'campo', type: 'text', label: 'Campo', width: 'full', rules: {}, ...target } as FormField],
    }],
  } as FormDefinition;
}

/** Monta el editor con estado real para poder afirmar sobre lo que produce. */
function Harness({ initial }: { initial: FormDefinition }) {
  const [definition, setDefinition] = useState(initial);
  const target = definition.containers[0]!.fields[1]!;
  return (
    <>
      <FieldEditor
        field={target}
        index={1}
        definition={definition}
        fieldErrors={collectDefinitionEditorErrors(definition, 'Demo').fields[target.id]}
        setDefinition={setDefinition}
      />
      <output data-testid="definicion">{JSON.stringify(definition.containers[0]!.fields[1])}</output>
    </>
  );
}

const produced = () => JSON.parse(screen.getByTestId('definicion').textContent!) as FormField;

async function openCard(label: string) {
  const heading = screen.getByText(label, { exact: true });
  const card = heading.closest('.configuration-card');
  if (!card) throw new Error(`No se encontró la tarjeta ${label}`);
  const trigger = card.querySelector('.configuration-card-trigger') as HTMLButtonElement | null;
  if (!trigger) throw new Error(`No se encontró el disparador de ${label}`);
  if (trigger.getAttribute('aria-expanded') === 'false') await userEvent.click(trigger);
}

async function addConfiguration(label: string) {
  await userEvent.click(screen.getByRole('button', { name: /Agregar configuración/ }));
  await userEvent.click(screen.getByRole('menuitem', { name: new RegExp(label) }));
}

describe('editor de campo · obligatoriedad fija y condicional', () => {
  it('con obligatorio fijo, la obligatoriedad condicional queda deshabilitada', async () => {
    render(<Harness initial={definitionWith({ rules: { required: true } })} />);
    await openCard('Obligatoriedad');
    await addConfiguration('Lógica condicional');
    expect(screen.getByLabelText('Obligatoriedad condicional').hasAttribute('disabled')).toBe(true);
  });

  it('con obligatoriedad condicional, el obligatorio fijo queda deshabilitado', async () => {
    render(<Harness initial={definitionWith({ conditions: { required: pointsAtGate } })} />);
    await addConfiguration('Obligatoriedad');
    await openCard('Obligatoriedad');
    await openCard('Lógica condicional');
    expect(screen.getByLabelText('Obligatorio').hasAttribute('disabled')).toBe(true);
  });

  it('sin obligatoriedad, las dos opciones están disponibles', async () => {
    render(<Harness initial={definitionWith({})} />);
    await addConfiguration('Obligatoriedad');
    await addConfiguration('Lógica condicional');
    expect(screen.getByLabelText('Obligatorio').hasAttribute('disabled')).toBe(false);
    expect(screen.getByLabelText('Obligatoriedad condicional').hasAttribute('disabled')).toBe(false);
  });

  it('marcar obligatorio no deja activar la condicional, y la definición sigue siendo válida', async () => {
    render(<Harness initial={definitionWith({})} />);

    await addConfiguration('Obligatoriedad');
    await addConfiguration('Lógica condicional');
    await userEvent.click(screen.getByLabelText('Obligatorio'));

    expect(produced().rules.required).toBe(true);
    expect(screen.getByLabelText('Obligatoriedad condicional').hasAttribute('disabled')).toBe(true);
    // Lo que importa: la definición que sale del editor pasa el contrato.
    expect(formDefinitionSchema.safeParse(definitionWith(produced())).success).toBe(true);
  });

  it('la visibilidad condicional sí convive con el obligatorio fijo', async () => {
    render(<Harness initial={definitionWith({ rules: { required: true } })} />);

    await addConfiguration('Lógica condicional');
    await userEvent.click(screen.getByLabelText('Visibilidad condicional'));

    const target = produced();
    expect(target.rules.required).toBe(true);
    expect(target.conditions?.visible).toBeDefined();
  });

  it('explica la semántica del obligatorio fijo al autor', async () => {
    render(<Harness initial={definitionWith({ rules: { required: true } })} />);
    await openCard('Obligatoriedad');
    expect(screen.getByText(/Obligatorio siempre que el campo esté visible y habilitado/)).toBeTruthy();
  });
});

/**
 * Una definición guardada antes de la regla de exclusividad puede traer las dos
 * obligatoriedades. Si el editor deshabilitara ambas —cada una por detectar a la
 * otra— esa definición quedaría irreparable: no se puede guardar por el conflicto
 * y no se puede desmarcar nada para resolverlo.
 */
describe('editor de campo · reparar una definición conflictiva', () => {
  const conflictiva = { rules: { required: true }, conditions: { required: pointsAtGate } };

  it('con las dos activas, ninguna queda bloqueada', async () => {
    render(<Harness initial={definitionWith(conflictiva)} />);
    await openCard('Obligatoriedad');
    await openCard('Lógica condicional');

    expect(screen.getByLabelText('Obligatorio').hasAttribute('disabled')).toBe(false);
    expect(screen.getByLabelText('Obligatoriedad condicional').hasAttribute('disabled')).toBe(false);
  });

  it('desmarcar la fija repara la definición y el contrato la acepta', async () => {
    render(<Harness initial={definitionWith(conflictiva)} />);

    await openCard('Obligatoriedad');
    await userEvent.click(screen.getByLabelText('Obligatorio'));

    const target = produced();
    expect(target.rules.required).toBeFalsy();
    expect(target.conditions?.required).toBeDefined();
    expect(formDefinitionSchema.safeParse(definitionWith(target)).success).toBe(true);
  });

  it('desmarcar la condicional también repara', async () => {
    render(<Harness initial={definitionWith(conflictiva)} />);

    await openCard('Lógica condicional');
    await userEvent.click(screen.getByLabelText('Obligatoriedad condicional'));

    const target = produced();
    expect(target.conditions?.required).toBeUndefined();
    expect(target.rules.required).toBe(true);
    expect(formDefinitionSchema.safeParse(definitionWith(target)).success).toBe(true);
  });

  it('una vez reparada, vuelve a bloquearse la opción que sobra', async () => {
    // El bloqueo tiene que volver, si no se podría recrear el conflicto.
    render(<Harness initial={definitionWith(conflictiva)} />);

    await openCard('Lógica condicional');
    await userEvent.click(screen.getByLabelText('Obligatoriedad condicional'));

    await openCard('Obligatoriedad');
    expect(screen.getByLabelText('Obligatoriedad condicional').hasAttribute('disabled')).toBe(true);
  });
});
