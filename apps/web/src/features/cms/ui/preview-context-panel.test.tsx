// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import type { DynamicFormPreviewState, ExternalVariable, ExternalVariableValues } from '@tramites/form-contracts';
import { PreviewContextPanel } from './preview-context-panel';

afterEach(cleanup);

const variables: ExternalVariable[] = [
  { name: 'insuranceCode', label: 'Código de seguro', type: 'string', trust: 'trusted' },
  { name: 'retryCount', label: 'Cantidad de intentos', type: 'number', trust: 'trusted' },
  { name: 'isMobile', label: 'Es móvil', type: 'boolean', trust: 'presentation' },
];

function renderPanel(initial: ExternalVariableValues = {}) {
  let current = initial;
  function Harness() {
    const [values, setValues] = useState(initial);
    current = values;
    return (
      <PreviewContextPanel
        variables={variables}
        values={values}
        onChange={(name, value) => {
          setValues((previous) => {
            const next = { ...previous };
            if (value === undefined) delete next[name];
            else next[name] = value;
            return next;
          });
        }}
        onReset={() => setValues({})}
      />
    );
  }

  const user = userEvent.setup();
  const view = render(<Harness />);
  return {
    user,
    view,
    get values() { return current; },
  };
}

describe('PreviewContextPanel', () => {
  it('muestra un control tipado por variable y marca las ausentes', () => {
    renderPanel();

    expect(screen.getByRole('heading', { name: 'Contexto de prueba' })).toBeTruthy();
    expect(screen.getByLabelText('Código de seguro (insuranceCode)')).toHaveProperty('type', 'text');
    expect(screen.getByLabelText('Cantidad de intentos (retryCount)')).toHaveProperty('type', 'number');
    expect(screen.getByLabelText('Es móvil (isMobile)')).toHaveProperty('type', 'checkbox');
    expect(screen.getAllByText('Ausente')).toHaveLength(3);
    expect(screen.getAllByText('Trusted')).toHaveLength(2);
    expect(screen.getByText('Presentación')).toBeTruthy();
  });

  it('propaga string, number y boolean en sus tipos reales y expone las props', async () => {
    const panel = renderPanel();

    await panel.user.type(screen.getByLabelText('Código de seguro (insuranceCode)'), '2050');
    await panel.user.type(screen.getByLabelText('Cantidad de intentos (retryCount)'), '3');
    await panel.user.click(screen.getByLabelText('Es móvil (isMobile)'));

    expect(panel.values).toEqual({ insuranceCode: '2050', retryCount: 3, isMobile: true });
    const props = screen.getByLabelText('Props de contexto');
    expect(props.textContent).toContain('"insuranceCode": "2050"');
    expect(props.textContent).toContain('"retryCount": 3');
    expect(props.textContent).toContain('"isMobile": true');
  });

  it('permite simular ausencia y restablecer todo el contexto', async () => {
    const panel = renderPanel({ insuranceCode: '2050', retryCount: 2, isMobile: false });
    expect(screen.getAllByText('Definida')).toHaveLength(3);

    await panel.user.clear(screen.getByLabelText('Código de seguro (insuranceCode)'));
    expect(panel.values).toEqual({ retryCount: 2, isMobile: false });

    await panel.user.click(screen.getByRole('button', { name: 'Restablecer' }));
    expect(panel.values).toEqual({});
    // The harness keeps values outside React state intentionally; remounting
    // verifies the panel's reset callback contract without testing its markup.
    panel.view.rerender(<PreviewContextPanel variables={variables} values={panel.values} onChange={() => undefined} onReset={() => undefined} />);
    expect(screen.getAllByText('Ausente')).toHaveLength(3);
  });

  it('muestra el estado efectivo y el payload simulado del renderer', () => {
    const state: DynamicFormPreviewState = {
      visible: true,
      enabled: false,
      included: true,
      payload: { insuranceCode: '2050' },
    };
    render(
      <PreviewContextPanel
        variables={variables}
        values={{ insuranceCode: '2050' }}
        state={state}
        onChange={() => undefined}
        onReset={() => undefined}
      />,
    );

    const effectiveState = screen.getByText('Estado efectivo').parentElement!;
    expect(within(effectiveState).getByText('Visible: Sí')).toBeTruthy();
    expect(within(effectiveState).getByText('Habilitado: No')).toBeTruthy();
    expect(within(effectiveState).getByText('Incluido: Sí')).toBeTruthy();
    expect(screen.getByLabelText('Payload simulado').textContent).toContain('"insuranceCode": "2050"');
  });
});
