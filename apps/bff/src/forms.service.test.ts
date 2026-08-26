import { describe, expect, it, vi } from 'vitest';
import { FormsService } from './forms.service';
import { REQUIRED_CONFLICT_MESSAGE, type FormDefinition } from '@tramites/form-contracts';

const conflictingDefinition = {
  schemaVersion: 3,
  tipificationKey: 'generic@v1',
  externalVariables: [],
  title: 'Legacy conflictivo',
  submitLabel: 'Enviar',
  containers: [{
    id: 'container-1',
    title: 'Datos',
    kind: 'section',
    columns: 1,
    fields: [
      { id: 'gate', fieldName: 'gate', type: 'text', label: 'Gate', width: 'full', rules: {} },
      {
        id: 'target',
        fieldName: 'target',
        type: 'text',
        label: 'Target',
        width: 'full',
        rules: { required: true },
        conditions: { required: { logic: 'all', rules: [{ source: { kind: 'field', fieldId: 'gate' }, operator: 'notEmpty' }] } },
      },
    ],
  }],
} as unknown as FormDefinition;

const form = {
  id: 1,
  public_id: '11111111-1111-4111-8111-111111111111',
  name: 'Legacy',
  draft_definition: conflictingDefinition,
  published_version_id: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function service() {
  const from = vi.fn(() => ({
    select: vi.fn(() => ({
      order: vi.fn().mockResolvedValue({ data: [form], error: null }),
      eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: form, error: null }) })),
    })),
  }));
  return new FormsService({ db: { from } } as never, {} as never);
}

describe('FormsService · compatibilidad con borradores legacy', () => {
  it('lista formularios aunque uno tenga el conflicto de obligatoriedad anterior', async () => {
    const result = await service().list();

    expect(result).toMatchObject([{ id: form.public_id, title: conflictingDefinition.title }]);
  });

  it('devuelve el borrador conflictivo para que el CMS pueda repararlo', async () => {
    const result = await service().getDraft(form.public_id);

    expect(result.definition).toEqual(conflictingDefinition);
    expect(REQUIRED_CONFLICT_MESSAGE).toContain('obligatoriedad condicional');
  });
});
