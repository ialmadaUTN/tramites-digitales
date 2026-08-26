// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flattenFields, formDefinitionSchema, type FormDefinition } from '@tramites/form-contracts';
import { validateSubmission } from '@tramites/form-contracts/validation';
import type { FormValues } from '../../../shared/types/form-values';

/**
 * La habilitación del **formulario completo** también cuenta para el asterisco.
 *
 * `validateSubmission` corta apenas ve el formulario deshabilitado y no exige
 * ningún campo, así que mostrar el asterisco ahí sería prometer una validación
 * que no va a ocurrir. La habilitación se hereda igual que la inclusión.
 *
 * Estos tests montan el `DynamicField` real —sin mockearlo— porque el asterisco
 * se pinta ahí: con el campo mockeado la regresión pasaría desapercibida.
 */

const mockRuntime = vi.hoisted(() => ({ current: undefined as any }));

vi.mock('../hooks/use-runtime-form', () => ({
  useRuntimeForm: () => mockRuntime.current,
}));

const { DynamicForm } = await import('./dynamic-form');

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/**
 * El formulario entero se habilita según una variable externa.
 *
 * Tiene que ser externa y no un campo: el contrato prohíbe que la condición del
 * formulario dependa de sus propios descendientes, y debe ser `trusted` porque
 * afecta controles y payload, no solo presentación.
 */
function definition(): FormDefinition {
  return formDefinitionSchema.parse({
    schemaVersion: 3,
    tipificationKey: 'generic@v1',
    externalVariables: [{ name: 'activo', label: 'Activo', type: 'boolean', trust: 'trusted' }],
    title: 'Habilitación del formulario',
    submitLabel: 'Enviar',
    conditions: {
      enabled: { logic: 'all', rules: [{ source: { kind: 'external', variable: 'activo' }, operator: 'equals', value: true }] },
    },
    containers: [{
      id: 'main',
      title: 'Datos',
      kind: 'section',
      columns: 1,
      fields: [
        { id: 'field-1', fieldName: 'campo', type: 'text', label: 'Campo', width: 'full', rules: { required: true } },
      ],
    }],
  });
}

function Harness({ activo }: { activo: boolean }) {
  const current = definition();
  const values: FormValues = { campo: '' };
  const { control } = useForm<FormValues>({ defaultValues: values });
  mockRuntime.current = {
    control,
    handleSubmit: () => (event: { preventDefault(): void }) => event.preventDefault(),
    values,
    errors: {},
    definition: current,
    fieldMap: new Map(flattenFields(current).map((field) => [field.id, field])),
    version: 1,
    loadError: null,
    receipt: null,
    submitting: false,
    remoteError: null,
    submit: () => {},
    uploadFile: undefined,
    externalVariables: { activo },
    contextToken: undefined,
  };
  return <DynamicForm formId="form-1" apiBaseUrl="http://bff.test" />;
}

/** El asterisco vive dentro del `<label>` del campo obligatorio. */
const hasMarker = () => Boolean(screen.queryByText('*'));

describe('DynamicForm · habilitación del formulario completo', () => {
  it('no marca el campo obligatorio cuando el formulario está deshabilitado', () => {
    render(<Harness activo={false} />);
    expect(hasMarker()).toBe(false);
  });

  it('lo marca cuando el formulario está habilitado', () => {
    render(<Harness activo={true} />);
    expect(hasMarker()).toBe(true);
  });

  it('la marca coincide con lo que el servidor exige, en las dos direcciones', () => {
    // El punto del ticket: contrato y runtime tienen que leer lo mismo. Si el
    // servidor no exige el campo, el asterisco no puede aparecer.
    const current = definition();

    // Deshabilitado: falla, pero por el formulario entero, no por el campo.
    const deshabilitado = validateSubmission(current, { campo: '' }, { activo: false });
    expect(deshabilitado.success).toBe(false);
    expect(deshabilitado.success ? {} : deshabilitado.errors).not.toHaveProperty('campo');

    const habilitado = validateSubmission(current, { campo: '' }, { activo: true });
    expect(habilitado.success ? {} : habilitado.errors).toHaveProperty('campo');
  });
});
