// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { afterEach, describe, expect, it } from 'vitest';
import type { FormField } from '@tramites/form-contracts';
import type { FormValues } from '../../../../shared/types/form-values';
import { DynamicField } from './dynamic-field';

/**
 * El asterisco tiene que significar exactamente lo que el servidor va a exigir.
 *
 * Antes se pintaba con la obligatoriedad **declarada**, así que un campo
 * deshabilitado por condición mostraba " *" y sin embargo el validador lo
 * salteaba: el usuario veía una exigencia que no existía.
 */

afterEach(cleanup);

const gate: FormField = { id: 'gate', fieldName: 'gate', type: 'text', label: 'Gate', width: 'full', rules: {} };
const pointsAtGate = { logic: 'all' as const, rules: [{ fieldId: 'gate', operator: 'equals' as const, value: 'si' }] };

function Harness({ target, values }: { target: FormField; values: FormValues }) {
  const { control } = useForm<FormValues>({ defaultValues: values });
  const fieldMap = new Map([[gate.id, gate], [target.id, target]]);
  return (
    <DynamicField field={target} control={control} values={values} errors={{}} fieldMap={fieldMap} />
  );
}

const target = (overrides: Partial<FormField>): FormField => ({
  id: 'target',
  fieldName: 'target',
  type: 'text',
  label: 'Objetivo',
  width: 'full',
  rules: {},
  ...overrides,
});

/** El asterisco vive dentro del `<label>` del campo. */
const hasMarker = () => Boolean(screen.queryByText('*'));

describe('marca de obligatorio en el runtime', () => {
  const cases: Array<{ name: string; field: FormField; gate: string; marca: boolean }> = [
    { name: 'fijo, sin condiciones', field: target({ rules: { required: true } }), gate: 'no', marca: true },
    { name: 'no obligatorio', field: target({}), gate: 'si', marca: false },

    // Habilitado por condición: la marca sigue a la habilitación.
    { name: 'fijo y habilitado', field: target({ rules: { required: true }, conditions: { enabled: pointsAtGate } }), gate: 'si', marca: true },
    { name: 'fijo y deshabilitado', field: target({ rules: { required: true }, conditions: { enabled: pointsAtGate } }), gate: 'no', marca: false },

    // Condicional pura.
    { name: 'condicional cumplida', field: target({ conditions: { required: pointsAtGate } }), gate: 'si', marca: true },
    { name: 'condicional incumplida', field: target({ conditions: { required: pointsAtGate } }), gate: 'no', marca: false },
  ];

  it.each(cases)('$name → marca=$marca', ({ field, gate: gateValue, marca }) => {
    render(<Harness target={field} values={{ gate: gateValue, target: '' }} />);
    expect(hasMarker()).toBe(marca);
  });

  it('un campo oculto no se renderiza en absoluto', () => {
    const { container } = render(
      <Harness target={target({ rules: { required: true }, conditions: { visible: pointsAtGate } })} values={{ gate: 'no', target: '' }} />,
    );
    expect(container.textContent).toBe('');
  });
});
