import { describe, expect, it } from 'vitest';
import type { AllowedMimeType, FormDefinition } from '@tramites/form-contracts';
import {
  addContainer,
  addFaqBlock,
  addExternalVariable,
  externalVariableCandidates,
  addField,
  addTextBlock,
  addConditionRule,
  addOption,
  changeFieldType,
  clearFieldConfiguration,
  moveContainer,
  moveFaqBlock,
  moveField,
  moveContainerItem,
  moveOption,
  parseDefaultValue,
  parseOptions,
  removeContainer,
  removeFaqBlock,
  removeField,
  removeExternalVariable,
  removeTextBlock,
  removeOption,
  serializeOptions,
  slugifyOptionValue,
  toggleFieldCondition,
  updateFaqBlock,
  setContainerCondition,
  setFormCondition,
  setConditionLogic,
  updateExternalVariable,
  updateTextBlock,
  updateOption,
  updateField,
  otherFields,
  setFieldCondition,
  updateConditionRule,
  removeConditionRule,
  toggleDefaultOption,
  setFieldDefaultValue,
  setFieldReadOnly,
  setFieldRule,
  setFieldErrorMessage,
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

  it('manages v3 variables and ordered informational blocks', () => {
    const v3 = { ...definition, schemaVersion: 3 as const, externalVariables: [] };
    const withVariable = addExternalVariable(v3);
    expect(withVariable.externalVariables?.[0]?.name).toBe('variable1');
    const updated = updateExternalVariable(withVariable, 'variable1', { label: 'Código', type: 'number', trust: 'trusted' });
    expect(updated.externalVariables?.[0]).toMatchObject({ label: 'Código', type: 'number', trust: 'trusted' });
    expect(removeExternalVariable(updated, 'variable1').externalVariables).toEqual([]);
    const twoVariables = addExternalVariable(withVariable);
    expect(updateExternalVariable(twoVariables, 'variable1', { label: 'Uno' }).externalVariables?.[1]?.label).toBe('Variable 2');
    expect(removeExternalVariable(twoVariables, 'missing').externalVariables).toHaveLength(2);

    const withBlock = addTextBlock(v3, 'c1');
    const block = withBlock.containers[0]?.items?.find((item) => item.kind === 'textBlock');
    expect(block?.kind).toBe('textBlock');
    const changed = updateTextBlock(withBlock, block!.id, (current) => ({ ...current, text: 'Ayuda' }));
    expect(changed.containers[0]?.items?.find((item) => item.kind === 'textBlock')).toMatchObject({ text: 'Ayuda' });
    expect(removeTextBlock(changed, block!.id).containers[0]?.items).toHaveLength(2);
    expect(addTextBlock(v3, 'missing')).toEqual(v3);
    expect(updateTextBlock(withBlock, 'missing', (current) => current)).toEqual(withBlock);
    expect(removeTextBlock(withBlock, 'missing')).toEqual(withBlock);
  });

  it('applies container and form conditions and keeps item order when moving fields', () => {
    const form = setFormCondition(definition, 'visible', { logic: 'all', rules: [{ fieldId: 'f1', operator: 'notEmpty' }] });
    expect(form.conditions?.visible).toBeTruthy();
    const container = setContainerCondition(definition.containers[0]!, 'enabled', { logic: 'all', rules: [{ fieldId: 'f1', operator: 'notEmpty' }] });
    expect(container.conditions?.enabled).toBeTruthy();
    const moved = moveField({ ...definition, containers: [{ ...definition.containers[0]!, items: definition.containers[0]!.fields.map((field) => ({ kind: 'field' as const, field })) }, definition.containers[1]!] }, 'f1', 1);
    expect(moved.containers[0]?.items?.map((item) => item.kind === 'field' ? item.field.id : item.id)).toEqual(['f2', 'f1']);
    expect(setContainerCondition(container, 'enabled', undefined).conditions).toBeUndefined();
    expect(setFormCondition(form, 'visible', undefined).conditions).toBeUndefined();
    expect(externalVariableCandidates(definition)).toEqual([]);
    expect(externalVariableCandidates({ ...definition, externalVariables: [{ name: 'v', label: 'V', type: 'string', trust: 'presentation' }] })).toHaveLength(1);
    expect(setConditionLogic({ logic: 'all', rules: [{ fieldId: 'f1', operator: 'notEmpty' }] }, 'any').logic).toBe('any');
    expect(addConditionRule({ logic: 'all', rules: [{ fieldId: 'f1', operator: 'notEmpty' }] }, { kind: 'external', variable: 'v' }).rules.at(-1)?.source).toEqual({ kind: 'external', variable: 'v' });
  });

  it('reordena bloques y campos en una única secuencia de ítems', () => {
    const ordered = {
      ...definition,
      containers: [{ ...definition.containers[0]!, items: [
        { kind: 'field' as const, field: definition.containers[0]!.fields[0]! },
        { kind: 'textBlock' as const, id: 'info', text: 'Ayuda' },
        { kind: 'field' as const, field: definition.containers[0]!.fields[1]! },
      ] }],
    };
    const moved = moveContainerItem(ordered, 'info', -1);
    expect(moved.containers[0]?.items?.map((item) => item.kind === 'field' ? item.field.id : item.id)).toEqual(['info', 'f1', 'f2']);
    expect(moved.containers[0]?.fields.map((field) => field.id)).toEqual(['f1', 'f2']);
  });

  it('covers ordered-item updates, condition editing and field rule helpers', () => {
    const ordered = { ...definition, containers: [{ ...definition.containers[0]!, items: definition.containers[0]!.fields.map((field) => ({ kind: 'field' as const, field })) }, definition.containers[1]!] };
    expect(updateField(ordered, 'f1', (field) => ({ ...field, label: 'Actualizado' })).containers[0]?.items?.[0]).toMatchObject({ kind: 'field', field: { label: 'Actualizado' } });
    expect(otherFields({ ...definition, containers: [...definition.containers, { id: 'r', title: 'R', kind: 'repeater', columns: 1, fields: [] }] }, 'f1')).toHaveLength(1);
    const field = definition.containers[0]!.fields[0]!;
    expect(setFieldCondition(field, 'visible', { logic: 'all', rules: [{ fieldId: 'f2', operator: 'equals', value: 'x' }] }).conditions?.visible).toBeTruthy();
    const condition = { logic: 'all' as const, rules: [{ fieldId: 'f1', operator: 'equals' as const, value: 'x' }, { fieldId: 'f2', operator: 'equals' as const, value: 'y' }] };
    expect(updateConditionRule(condition, 1, { value: 'z' }).rules[1]?.value).toBe('z');
    expect(removeConditionRule(condition, 0).rules).toHaveLength(1);
    expect(removeConditionRule({ ...condition, rules: condition.rules.slice(0, 1) }, 0)).toEqual({ ...condition, rules: condition.rules.slice(0, 1) });
    expect(toggleDefaultOption(undefined, 'x', true)).toEqual(['x']);
    expect(toggleDefaultOption(['x'], 'x', false)).toBeUndefined();
    expect(setFieldDefaultValue(field, 'x').defaultValue).toBe('x');
    expect(setFieldDefaultValue(field, undefined).defaultValue).toBeUndefined();
    expect(setFieldReadOnly(field, true).readOnly).toBe(true);
    expect(setFieldReadOnly(setFieldReadOnly(field, true), false).readOnly).toBeUndefined();
    expect(setFieldRule(field, 'required', true).rules.required).toBe(true);
    expect(setFieldRule(setFieldRule(field, 'required', true), 'required', false).rules.required).toBeUndefined();
    expect(setFieldErrorMessage(field, 'required', 'Obligatorio').rules.errorMessages?.required).toBe('Obligatorio');
    expect(setFieldErrorMessage(setFieldErrorMessage(field, 'required', 'Obligatorio'), 'required', ' ').rules.errorMessages).toBeUndefined();
  });

  it('limpia cada tarjeta de configuración sin tocar la identidad del campo', () => {
    const configured = {
      ...definition.containers[0]!.fields[0]!,
      placeholder: 'Ayuda',
      helpText: 'Detalle',
      width: 'half' as const,
      defaultValue: 'Inicial',
      maskKind: 'dni_ar' as const,
      readOnly: true,
      minFiles: 1,
      maxFiles: 2,
      allowedMimeTypes: ['application/pdf'] as AllowedMimeType[],
      conditions: { visible: { logic: 'all' as const, rules: [{ fieldId: 'f2', operator: 'notEmpty' as const }] } },
      rules: {
        required: true,
        minLength: 2,
        maxLength: 8,
        pattern: '^[A-Z]+$',
        errorMessages: { required: 'Falta' },
      },
    };

    expect(clearFieldConfiguration(configured, 'presentation')).toMatchObject({ fieldName: 'a', type: 'text', width: 'half' });
    expect(clearFieldConfiguration(configured, 'presentation').placeholder).toBeUndefined();
    expect(clearFieldConfiguration(configured, 'layout').width).toBe('full');
    expect(clearFieldConfiguration(configured, 'defaultValue').defaultValue).toBeUndefined();
    expect(clearFieldConfiguration(configured, 'required').rules.required).toBeUndefined();
    expect(clearFieldConfiguration(configured, 'limits').rules).toEqual({ pattern: '^[A-Z]+$', required: true, errorMessages: { required: 'Falta' } });
    expect(clearFieldConfiguration(configured, 'pattern').rules.pattern).toBeUndefined();
    expect(clearFieldConfiguration(configured, 'mask').maskKind).toBeUndefined();
    expect(clearFieldConfiguration(configured, 'messages').rules.errorMessages).toBeUndefined();
    expect(clearFieldConfiguration(configured, 'readOnly').readOnly).toBeUndefined();
    expect(clearFieldConfiguration(configured, 'files').allowedMimeTypes).toBeUndefined();
    expect(clearFieldConfiguration(configured, 'conditions').conditions).toBeUndefined();
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
