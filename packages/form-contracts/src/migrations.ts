import type { ConditionGroup, ConditionRule, FormDefinition } from './index.js';

function containerFields<T, I extends { kind: string }>(container: { fields: T[]; items?: I[] }): T[] {
  const items = container.items ?? container.fields.map((field) => ({ kind: 'field' as const, field }));
  return items.filter((item): item is { kind: 'field'; field: T } => item.kind === 'field').map((item) => item.field);
}

function normalizeRule(rule: ConditionRule): ConditionRule {
  if (rule.source || !rule.fieldId) return rule;
  const { fieldId, ...rest } = rule;
  return { ...rest, source: { kind: 'field', fieldId } };
}

function normalizeGroup(group: ConditionGroup): ConditionGroup {
  return {
    ...group,
    rules: group.rules.map(normalizeRule),
    groups: group.groups?.map(normalizeGroup),
  };
}

function normalizeConditions<T extends Record<string, ConditionGroup | undefined> | undefined>(conditions: T): T {
  if (!conditions) return conditions;
  return Object.fromEntries(Object.entries(conditions).map(([key, group]) => [key, group ? normalizeGroup(group) : group])) as T;
}

/**
 * Makes a legacy draft editable with the v2 capabilities that v3 preserves.
 * This module intentionally imports only types from the barrel so the CMS can
 * use it through a bundler-safe subpath.
 */
export function upgradeDefinitionToV2(definition: FormDefinition, tipificationKey = 'generic@v1'): FormDefinition {
  if (definition.schemaVersion === 2 || definition.schemaVersion === 3) return definition;
  return {
    ...definition,
    schemaVersion: 2,
    tipificationKey: definition.tipificationKey ?? tipificationKey,
    containers: definition.containers.map((container) => ({
      ...container,
      kind: container.kind ?? 'section',
      fields: containerFields(container).map((field) => (
        field.type === 'combobox' && field.allowCustomValue === undefined
          ? { ...field, allowCustomValue: true }
          : field
      )),
    })),
  };
}

/** Projects legacy field arrays into the ordered v3 item representation. */
export function upgradeDefinitionToV3(definition: FormDefinition, tipificationKey = 'generic@v1'): FormDefinition {
  const base = definition.schemaVersion === 3 ? definition : definition.schemaVersion === 2 ? definition : upgradeDefinitionToV2(definition, tipificationKey);
  return {
    ...base,
    schemaVersion: 3,
    tipificationKey: base.tipificationKey ?? tipificationKey,
    externalVariables: base.externalVariables ?? [],
    conditions: normalizeConditions(base.conditions),
    containers: base.containers.map((container) => {
      const fields = containerFields(container);
      const normalizedFields = fields.map((field) => ({ ...field, conditions: normalizeConditions(field.conditions) }));
      return {
        ...container,
        kind: container.kind ?? 'section',
        conditions: normalizeConditions(container.conditions),
        fields: normalizedFields,
        items: (container.items ?? normalizedFields.map((field) => ({ kind: 'field' as const, field }))).map((item) => item.kind === 'field'
          ? { ...item, field: { ...item.field, conditions: normalizeConditions(item.field.conditions) } }
          : { ...item, conditions: normalizeConditions(item.conditions) }),
      };
    }),
  };
}
