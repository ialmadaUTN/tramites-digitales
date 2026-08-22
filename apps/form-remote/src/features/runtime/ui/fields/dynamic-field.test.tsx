// @vitest-environment jsdom
import { useForm } from 'react-hook-form';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { FormField } from '@tramites/form-contracts';
import type { FormValues } from '../../../../shared/types/form-values';
import { DynamicField } from './dynamic-field';

afterEach(cleanup);

const field = (conditions: FormField['conditions']): FormField => ({
  id: 'f1', fieldName: 'detail', type: 'text', label: 'Detalle', width: 'full', rules: { required: true }, conditions,
});

function Harness({ target, externalVariables }: { target: FormField; externalVariables: Record<string, unknown> }) {
  const { control } = useForm<FormValues>({ defaultValues: { detail: 'conservado' } });
  return <DynamicField field={target} control={control} values={{ detail: 'conservado' }} errors={{}} fieldMap={new Map([['f1', target]])} externalVariables={externalVariables} />;
}

describe('DynamicField con contexto externo', () => {
  it('oculta el campo y sus controles cuando la visibilidad o inclusión no se cumple', () => {
    const target = field({
      visible: { logic: 'all', rules: [{ source: { kind: 'external', variable: 'insuranceCode' }, operator: 'equals', value: '2050' }] },
      included: { logic: 'all', rules: [{ source: { kind: 'external', variable: 'insuranceCode' }, operator: 'equals', value: '2050' }] },
    });
    const { rerender } = render(<Harness target={target} externalVariables={{ insuranceCode: '9999' }} />);
    expect(screen.queryByLabelText('Detalle')).toBeNull();
    rerender(<Harness target={target} externalVariables={{ insuranceCode: '2050' }} />);
    expect(screen.getByLabelText(/Detalle/)).toBeTruthy();
  });

  it('deshabilita la interacción y quita obligatoriedad sin perder el valor', () => {
    const target = field({
      enabled: { logic: 'all', rules: [{ source: { kind: 'external', variable: 'insuranceCode' }, operator: 'equals', value: '2050' }] },
    });
    render(<Harness target={target} externalVariables={{ insuranceCode: '9999' }} />);
    expect(screen.getByRole('textbox')).toHaveProperty('disabled', true);
    expect(screen.getByText('Detalle').textContent).not.toContain('*');
  });
});
