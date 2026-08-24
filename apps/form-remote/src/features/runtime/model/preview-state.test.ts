import { describe, expect, it } from 'vitest';
import { formDefinitionSchema, type FormDefinition } from '@tramites/form-contracts';
import { evaluatePreviewState } from './preview-state';

function condition(operator: 'equals' | 'in', value: string | string[]) {
  return {
    logic: 'all' as const,
    rules: [{ source: { kind: 'external' as const, variable: 'insuranceCode' }, operator, value }],
  };
}

function definition(): FormDefinition {
  return formDefinitionSchema.parse({
    schemaVersion: 3,
    tipificationKey: 'generic@v1',
    externalVariables: [{ name: 'insuranceCode', label: 'Código de seguro', type: 'string', trust: 'trusted' }],
    title: 'Preview',
    submitLabel: 'Enviar',
    containers: [{
      id: 'main',
      title: 'Datos',
      fields: [
        { id: 'visible', fieldName: 'visibleValue', type: 'text', label: 'Visible', width: 'full', rules: {} },
        {
          id: 'conditional',
          fieldName: 'conditionalValue',
          type: 'text',
          label: 'Condicional',
          width: 'full',
          rules: {},
          conditions: { visible: condition('equals', '9999'), included: condition('in', ['9999', '8888']) },
        },
      ],
    }],
  });
}

describe('evaluatePreviewState', () => {
  it('usa las mismas reglas del contrato y omite campos ocultos del payload', () => {
    const state = evaluatePreviewState(
      definition(),
      { visibleValue: 'ok', conditionalValue: 'secret' },
      { insuranceCode: '2050' },
    );

    expect(state).toEqual({ visible: true, enabled: true, included: true, payload: { visibleValue: 'ok' } });
  });

  it('refleja un formulario no visible y no expone ningún valor', () => {
    const form = definition();
    form.conditions = { visible: condition('equals', '2050') };

    const state = evaluatePreviewState(form, { visibleValue: 'ok' }, { insuranceCode: '9999' });

    expect(state.visible).toBe(false);
    expect(state.payload).toEqual({});
  });

  it('conserva en el payload un campo deshabilitado si sigue incluido y tiene valor', () => {
    const form = definition();
    const firstField = form.containers[0]!.fields[0]!;
    firstField.conditions = { enabled: condition('equals', '9999') };

    const state = evaluatePreviewState(form, { visibleValue: 'preserved' }, { insuranceCode: '2050' });

    expect(state.enabled).toBe(true);
    expect(state.payload).toEqual({ visibleValue: 'preserved' });
  });
});
