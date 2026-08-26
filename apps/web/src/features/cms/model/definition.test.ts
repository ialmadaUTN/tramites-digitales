import { describe, expect, it } from 'vitest';
import type { FormDefinition } from '@tramites/form-contracts';
import {
  addContainer,
  addFaqBlock,
  addField,
  addOption,
  changeFieldType,
  moveContainer,
  moveFaqBlock,
  moveField,
  moveOption,
  parseDefaultValue,
  parseOptions,
  removeContainer,
  removeFaqBlock,
  removeField,
  removeOption,
  serializeOptions,
  slugifyOptionValue,
  toggleFieldCondition,
  updateFaqBlock,
  updateOption,
} from './definition';

const definition: FormDefinition = {
  title: 'Demo',
  submitLabel: 'Enviar',
  containers: [
    {
      id: 'c1',
      title: 'Uno',
      columns: 1,
      fields: [
        { id: 'f1', fieldName: 'a', type: 'text', label: 'A', width: 'full', rules: {} },
        { id: 'f2', fieldName: 'b', type: 'text', label: 'B', width: 'full', rules: {} },
      ],
    },
    { id: 'c2', title: 'Dos', columns: 1, fields: [] },
  ],
};

describe('definition mutations', () => {
  it('moves containers and fields within bounds', () => {
    expect(moveContainer(definition, 'c1', 1).containers.map((container) => container.id)).toEqual(['c2', 'c1']);
    expect(moveContainer(definition, 'c1', -1)).toBe(definition);
    expect(moveField(definition, 'f1', 1).containers[0]?.fields.map((field) => field.id)).toEqual(['f2', 'f1']);
  });

  it('adds and removes containers and fields', () => {
    const withContainer = addContainer(definition);
    expect(withContainer.containers).toHaveLength(3);
    expect(removeContainer(withContainer, 'c2').containers.map((container) => container.id)).toEqual(['c1', withContainer.containers[2]?.id]);
    const withField = addField(definition, 'c2');
    expect(withField.containers[1]?.fields).toHaveLength(1);
    expect(removeField(withField, withField.containers[1]?.fields[0]?.id ?? '').containers[1]?.fields).toEqual([]);
  });

  it('parses options and default values', () => {
    expect(parseOptions('yes|Sí\nno|No')).toEqual([
      { value: 'yes', label: 'Sí' },
      { value: 'no', label: 'No' },
    ]);
    expect(serializeOptions([{ value: 'yes', label: 'Sí' }])).toBe('yes|Sí');
    expect(parseDefaultValue('number', '12')).toBe(12);
    expect(parseDefaultValue('checkbox', 'true')).toBe(true);
    expect(parseDefaultValue('text', '')).toBeUndefined();
  });

  it('prepares options when switching to a choice field', () => {
    const field = changeFieldType(definition.containers[0]!.fields[0]!, 'select');
    expect(field.type).toBe('select');
    expect(field.options).toEqual([{ label: 'Opción', value: 'option' }]);
  });

  it('manages options list mutations and slugification', () => {
    expect(slugifyOptionValue('Tipo de Siniestro')).toBe('tipo_de_siniestro');
    expect(slugifyOptionValue('Opción #3!')).toBe('opcion_3');

    const initial = [{ label: 'Robo', value: 'theft' }];
    const added = addOption(initial, 'Accidente');
    expect(added).toEqual([
      { label: 'Robo', value: 'theft' },
      { label: 'Accidente', value: 'accidente' },
    ]);

    const updated = updateOption(added, 1, { label: 'Accidente Total', value: 'accident_total' });
    expect(updated[1]).toEqual({ label: 'Accidente Total', value: 'accident_total' });

    const moved = moveOption(updated, 1, -1);
    expect(moved.map((opt) => opt.value)).toEqual(['accident_total', 'theft']);

    const removed = removeOption(moved, 0);
    expect(removed).toEqual([{ label: 'Robo', value: 'theft' }]);
  });

  it('toggles conditional rules without leaving an empty object', () => {
    const enabled = toggleFieldCondition(definition.containers[0]!.fields[0]!, 'visible', true, 'f2');
    expect(enabled.conditions?.visible?.rules[0]?.fieldId).toBe('f2');
    expect(toggleFieldCondition(enabled, 'visible', false, 'f2').conditions).toBeUndefined();
  });
});

describe('faq block mutations', () => {
  it('adds a faq block with an empty answer and no faqBlocks array yet', () => {
    const withFaq = addFaqBlock(definition);
    expect(withFaq.faqBlocks).toHaveLength(1);
    expect(withFaq.faqBlocks?.[0]).toMatchObject({ answer: '', initiallyOpen: false });
    expect(definition.faqBlocks).toBeUndefined();
  });

  it('moves a faq block within bounds and no-ops out of bounds', () => {
    const withTwo = addFaqBlock(addFaqBlock(definition));
    const [first, second] = withTwo.faqBlocks!;
    const moved = moveFaqBlock(withTwo, first!.id, 1);
    expect(moved.faqBlocks?.map((block) => block.id)).toEqual([second!.id, first!.id]);
    expect(moveFaqBlock(withTwo, first!.id, -1)).toBe(withTwo);
  });

  it('updates and removes a faq block by id', () => {
    const withFaq = addFaqBlock(definition);
    const blockId = withFaq.faqBlocks![0]!.id;
    const updated = updateFaqBlock(withFaq, blockId, (block) => ({ ...block, question: '¿Cuándo?', answer: 'Mañana' }));
    expect(updated.faqBlocks?.[0]).toMatchObject({ question: '¿Cuándo?', answer: 'Mañana' });
    expect(removeFaqBlock(updated, blockId).faqBlocks).toEqual([]);
  });
});
