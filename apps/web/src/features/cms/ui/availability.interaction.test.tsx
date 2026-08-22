// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FormDefinition } from '@tramites/form-contracts';
import type { FormSummary } from '../api/forms-api';
import { INITIAL_DEFINITION } from '../model/constants';
import { collectDefinitionEditorErrors } from '../model/editor-validation';
import { FormList } from './form-list';
import { WorkspaceHeader } from './workspace-header';

/**
 * Interacción, no markup: lo que importa es qué estado muestra el listado y qué
 * handler dispara el botón. Un botón cableado al handler equivocado renderiza igual.
 */

afterEach(cleanup);

const summary = (overrides: Partial<FormSummary> = {}): FormSummary => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Denuncia',
  title: 'Denuncia',
  published: false,
  paused: false,
  pausedAt: null,
  updatedAt: '2026-08-20T22:00:00.000Z',
  ...overrides,
});

function renderList(form: FormSummary) {
  return render(
    <FormList forms={[form]} selectedId={null} saving={false} onCreate={() => {}} onSelect={() => {}} />,
  );
}

describe('listado del CMS · estado de disponibilidad', () => {
  // La precedencia importa: un formulario pausado sigue teniendo versión publicada,
  // y mostrarlo como "Publicado" haría creer que está disponible en el portal.
  const cases: Array<{ name: string; published: boolean; paused: boolean; expected: string }> = [
    { name: 'sin publicar', published: false, paused: false, expected: 'Borrador' },
    { name: 'publicado', published: true, paused: false, expected: 'Publicado' },
    { name: 'publicado y pausado', published: true, paused: true, expected: 'Pausado' },
    { name: 'pausado sin publicar', published: false, paused: true, expected: 'Pausado' },
  ];

  it.each(cases)('$name → $expected', ({ published, paused, expected }) => {
    renderList(summary({ published, paused }));
    expect(screen.getByText(expected)).toBeTruthy();
  });

  it('un formulario pausado no se muestra como Publicado', () => {
    renderList(summary({ published: true, paused: true }));
    expect(screen.queryByText('Publicado')).toBeNull();
  });
});

function renderHeader(overrides: { published?: boolean; paused?: boolean; onToggleAvailability?: () => void } = {}) {
  const definition: FormDefinition = INITIAL_DEFINITION;
  const onToggleAvailability = overrides.onToggleAvailability ?? vi.fn();
  render(
    <WorkspaceHeader
      title="Denuncia"
      formId="11111111-1111-4111-8111-111111111111"
      name="Denuncia"
      definition={definition}
      editorErrors={collectDefinitionEditorErrors(definition, 'Denuncia')}
      status={null}
      saving={false}
      preview={false}
      published={overrides.published ?? true}
      paused={overrides.paused ?? false}
      onNameChange={() => {}}
      onDefinitionChange={() => {}}
      onTogglePreview={() => {}}
      onSave={() => {}}
      onPublish={() => {}}
      onToggleAvailability={onToggleAvailability}
    />,
  );
  return { onToggleAvailability };
}

describe('workspace del CMS · pausar y reactivar', () => {
  it('ofrece Pausar sobre un formulario publicado y disponible', () => {
    renderHeader({ published: true, paused: false });
    expect(screen.getByRole('button', { name: /Pausar/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Reactivar/ })).toBeNull();
  });

  it('ofrece Reactivar cuando está pausado, y lo marca en el encabezado', () => {
    renderHeader({ published: true, paused: true });
    expect(screen.getByRole('button', { name: /Reactivar/ })).toBeTruthy();
    expect(screen.getByText('Pausado')).toBeTruthy();
  });

  it('no ofrece pausar un formulario que nunca se publicó', () => {
    // Pausar es sacar de circulación lo publicado: sin versión publicada no hay nada que pausar.
    renderHeader({ published: false, paused: false });
    expect(screen.queryByRole('button', { name: /Pausar/ })).toBeNull();
  });

  it('el botón dispara el handler de disponibilidad y no el de publicar', async () => {
    const onToggleAvailability = vi.fn();
    renderHeader({ published: true, paused: false, onToggleAvailability });

    await userEvent.click(screen.getByRole('button', { name: /Pausar/ }));

    expect(onToggleAvailability).toHaveBeenCalledTimes(1);
  });
});

describe('workspace del CMS · completitud estructural', () => {
  function renderWithDefinition(definition: FormDefinition) {
    const onPublish = vi.fn();
    const onSave = vi.fn();
    render(
      <WorkspaceHeader
        title="Demo"
        formId="11111111-1111-4111-8111-111111111111"
        name="Demo"
        definition={definition}
        editorErrors={collectDefinitionEditorErrors(definition, 'Demo')}
        status={null}
        saving={false}
        preview={false}
        published={false}
        paused={false}
        onNameChange={() => {}}
        onDefinitionChange={() => {}}
        onTogglePreview={() => {}}
        onSave={onSave}
        onPublish={onPublish}
        onToggleAvailability={() => {}}
      />,
    );
    return { onPublish, onSave };
  }

  const complete: FormDefinition = {
    schemaVersion: 2,
    tipificationKey: 'generic@v1',
    title: 'Demo',
    submitLabel: 'Enviar',
    containers: [{
      id: 'c1',
      title: 'Uno',
      kind: 'section',
      columns: 1,
      fields: [{ id: 'f1', fieldName: 'nombre', type: 'text', label: 'Nombre', width: 'full', rules: {} }],
    }],
  };

  it('con un contenedor vacío, Publicar queda deshabilitado y Guardar no', async () => {
    // La decisión del ticket: el borrador incompleto se guarda, no se publica.
    const incomplete = { ...complete, containers: [{ ...complete.containers[0]!, fields: [] }] };
    const { onSave, onPublish } = renderWithDefinition(incomplete);

    expect(screen.getByRole('button', { name: /Publicar/ }).hasAttribute('disabled')).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: /Guardar/ }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onPublish).not.toHaveBeenCalled();
  });

  it('con el formulario completo, Publicar se habilita', async () => {
    const { onPublish } = renderWithDefinition(complete);

    await userEvent.click(screen.getByRole('button', { name: /Publicar/ }));
    expect(onPublish).toHaveBeenCalledTimes(1);
  });
});
