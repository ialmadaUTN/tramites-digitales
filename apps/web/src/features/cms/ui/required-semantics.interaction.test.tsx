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

describe('editor de campo · obligatoriedad fija y condicional', () => {
  it('con obligatorio fijo, la obligatoriedad condicional queda deshabilitada', () => {
    render(<Harness initial={definitionWith({ rules: { required: true } })} />);
    expect(screen.getByLabelText('Obligatoriedad condicional').hasAttribute('disabled')).toBe(true);
  });

  it('con obligatoriedad condicional, el obligatorio fijo queda deshabilitado', () => {
    render(<Harness initial={definitionWith({ conditions: { required: pointsAtGate } })} />);
    expect(screen.getByLabelText('Obligatorio').hasAttribute('disabled')).toBe(true);
  });

  it('sin obligatoriedad, las dos opciones están disponibles', () => {
    render(<Harness initial={definitionWith({})} />);
    expect(screen.getByLabelText('Obligatorio').hasAttribute('disabled')).toBe(false);
    expect(screen.getByLabelText('Obligatoriedad condicional').hasAttribute('disabled')).toBe(false);
  });

  it('marcar obligatorio no deja activar la condicional, y la definición sigue siendo válida', async () => {
    render(<Harness initial={definitionWith({})} />);

    await userEvent.click(screen.getByLabelText('Obligatorio'));

    expect(produced().rules.required).toBe(true);
    expect(screen.getByLabelText('Obligatoriedad condicional').hasAttribute('disabled')).toBe(true);
    // Lo que importa: la definición que sale del editor pasa el contrato.
    expect(formDefinitionSchema.safeParse(definitionWith(produced())).success).toBe(true);
  });

  it('la visibilidad condicional sí convive con el obligatorio fijo', async () => {
    render(<Harness initial={definitionWith({ rules: { required: true } })} />);

    await userEvent.click(screen.getByLabelText('Visibilidad condicional'));

    const target = produced();
    expect(target.rules.required).toBe(true);
    expect(target.conditions?.visible).toBeDefined();
  });

  it('explica la semántica del obligatorio fijo al autor', () => {
    render(<Harness initial={definitionWith({ rules: { required: true } })} />);
    expect(screen.getByText(/Obligatorio siempre que el campo esté visible y habilitado/)).toBeTruthy();
  });
});
