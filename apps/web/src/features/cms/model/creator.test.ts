import { describe, expect, it } from 'vitest';
import type { FormContainer, FormDefinition, FormField } from '@tramites/form-contracts';
import { formDefinitionSchema } from '@tramites/form-contracts';
import { validateSubmission } from '@tramites/form-contracts/validation';
import { INITIAL_DEFINITION } from './constants';
import {
  addConditionRule,
  addField,
  addRepeater,
  changeFieldType,
  otherFields,
  setFieldCondition,
  setFieldDefaultValue,
  setFieldReadOnly,
  setFieldRule,
  toggleDefaultOption,
  toggleFieldCondition,
  updateContainer,
  updateField,
} from './definition';
import { collectDefinitionEditorErrors } from './editor-validation';

/** Último contenedor / campo agregado, que es sobre el que opera cada escenario. */
const lastContainer = (definition: FormDefinition): FormContainer =>
  definition.containers[definition.containers.length - 1]!;
const lastField = (container: FormContainer): FormField => container.fields[container.fields.length - 1]!;
const findField = (definition: FormDefinition, fieldId: string): FormField =>
  definition.containers.flatMap((container) => container.fields).find((field) => field.id === fieldId)!;

const contractErrors = (definition: FormDefinition): string[] => {
  const parsed = formDefinitionSchema.safeParse(definition);
  return parsed.success ? [] : parsed.error.issues.map((issue) => issue.message);
};

/** El primer campo de `INITIAL_DEFINITION` es un texto llamado `name`. */
function baseDefinition(): FormDefinition {
  return structuredClone(INITIAL_DEFINITION);
}

/** Crea una grilla con una columna del tipo indicado y devuelve los ids resultantes. */
function withRepeater(type: FormField['type'] = 'text') {
  let definition = addRepeater(baseDefinition());
  const container = lastContainer(definition);
  definition = addField(definition, container.id);
  const cell = lastField(lastContainer(definition));
  definition = updateField(definition, cell.id, (current) => changeFieldType(current, type));
  return { definition, containerId: container.id, cellId: cell.id };
}

describe('creación de grillas repetibles', () => {
  it('crea una grilla con clave de payload, límites de filas y columnas propias', () => {
    const { definition, containerId, cellId } = withRepeater('number');
    const container = definition.containers.find((entry) => entry.id === containerId)!;

    expect(container.kind).toBe('repeater');
    expect(container.fieldName).toMatch(/^rows\d+$/);
    expect(container.minRows).toBe(0);
    expect(container.maxRows).toBe(10);
    expect(findField(definition, cellId).type).toBe('number');
    expect(contractErrors(definition)).toEqual([]);
    expect(collectDefinitionEditorErrors(definition, 'Formulario').hasErrors).toBe(false);
  });

  it('marca una grilla sin columnas y los límites de filas inconsistentes', () => {
    const empty = addRepeater(baseDefinition());
    expect(collectDefinitionEditorErrors(empty, 'Formulario').containers[lastContainer(empty).id]?.fields).toMatch(
      /al menos una columna/,
    );

    const { definition, containerId } = withRepeater();
    const inverted = updateContainer(definition, containerId, (current) => ({ ...current, minRows: 5, maxRows: 2 }));
    expect(collectDefinitionEditorErrors(inverted, 'Formulario').containers[containerId]?.rows).toMatch(/no puede superar/);

    const fractional = updateContainer(definition, containerId, (current) => ({ ...current, maxRows: 2.5 }));
    expect(collectDefinitionEditorErrors(fractional, 'Formulario').containers[containerId]?.rows).toMatch(/enteros/);

    const outOfRange = updateContainer(definition, containerId, (current) => ({ ...current, maxRows: 80 }));
    expect(collectDefinitionEditorErrors(outOfRange, 'Formulario').containers[containerId]?.rows).toMatch(/entre 1 y 50/);
  });

  it('rechaza tipos de columna que la grilla no soporta', () => {
    const { definition, cellId } = withRepeater();
    const withTextarea = updateField(definition, cellId, (current) => changeFieldType(current, 'textarea'));

    expect(collectDefinitionEditorErrors(withTextarea, 'Formulario').fields[cellId]?.type).toMatch(/no está permitido/);
    expect(contractErrors(withTextarea).join(' ')).toMatch(/no está permitido dentro de una grilla/);
  });

  it('permite marcar una celda como obligatoria y el validador la exige por fila', () => {
    const { definition, containerId, cellId } = withRepeater();
    const required = updateField(definition, cellId, (current) => setFieldRule(current, 'required', true));
    const container = required.containers.find((entry) => entry.id === containerId)!;
    const cell = findField(required, cellId);

    expect(cell.rules.required).toBe(true);
    expect(collectDefinitionEditorErrors(required, 'Formulario').hasErrors).toBe(false);

    const parsed = formDefinitionSchema.parse(required);
    expect(validateSubmission(parsed, { name: 'Ana', [container.fieldName!]: [{ [cell.fieldName]: '' }] })).toMatchObject({
      success: false,
      errors: { [`${container.fieldName}.0.${cell.fieldName}`]: 'Este campo es obligatorio' },
    });
    expect(validateSubmission(parsed, { name: 'Ana', [container.fieldName!]: [{ [cell.fieldName]: 'ok' }] })).toMatchObject({
      success: true,
    });
  });
});

describe('configuración de máscaras', () => {
  it('acepta una máscara sobre un campo de texto y la valida en el envío', () => {
    const definition = updateField(baseDefinition(), 'field-1', (current) => ({ ...current, maskKind: 'cuit_ar' }));

    expect(collectDefinitionEditorErrors(definition, 'Formulario').hasErrors).toBe(false);
    const parsed = formDefinitionSchema.parse(definition);
    expect(validateSubmission(parsed, { name: '20-12345678-3' })).toMatchObject({ success: true, data: { name: '20123456783' } });
    expect(validateSubmission(parsed, { name: '20-123' })).toMatchObject({ success: false });
  });

  it('marca la máscara sobre un tipo que no la admite y la descarta al cambiar de tipo', () => {
    const masked = updateField(baseDefinition(), 'field-1', (current) => ({ ...current, maskKind: 'dni_ar' }));
    const invalid = updateField(masked, 'field-1', (current) => ({ ...current, type: 'number' }));
    expect(collectDefinitionEditorErrors(invalid, 'Formulario').fields['field-1']?.mask).toMatch(/no es compatible/);

    const retyped = updateField(masked, 'field-1', (current) => changeFieldType(current, 'number'));
    expect(findField(retyped, 'field-1').maskKind).toBeUndefined();
    expect(collectDefinitionEditorErrors(retyped, 'Formulario').hasErrors).toBe(false);
  });
});

describe('campos de catálogo', () => {
  it('crea un multiselect con valores por defecto tomados del catálogo', () => {
    let definition = updateField(baseDefinition(), 'field-1', (current) => changeFieldType(current, 'multiselect'));
    definition = updateField(definition, 'field-1', (current) => ({
      ...current,
      options: [
        { label: 'Rojo', value: 'red' },
        { label: 'Azul', value: 'blue' },
      ],
    }));
    definition = updateField(definition, 'field-1', (current) =>
      setFieldDefaultValue(current, toggleDefaultOption(current.defaultValue, 'red', true)),
    );

    expect(findField(definition, 'field-1').defaultValue).toEqual(['red']);
    expect(collectDefinitionEditorErrors(definition, 'Formulario').hasErrors).toBe(false);
    expect(contractErrors(definition)).toEqual([]);

    const outsider = updateField(definition, 'field-1', (current) => setFieldDefaultValue(current, ['green']));
    expect(collectDefinitionEditorErrors(outsider, 'Formulario').fields['field-1']?.defaultValue).toMatch(/no está en el catálogo/);
  });

  it('configura un combobox estricto y rechaza valores fuera del listado', () => {
    let definition = updateField(baseDefinition(), 'field-1', (current) => changeFieldType(current, 'combobox'));
    definition = updateField(definition, 'field-1', (current) => ({
      ...current,
      allowCustomValue: false,
      options: [
        { label: 'Buenos Aires', value: 'ba' },
        { label: 'Córdoba', value: 'cba' },
      ],
    }));

    expect(findField(definition, 'field-1').allowCustomValue).toBe(false);
    expect(collectDefinitionEditorErrors(definition, 'Formulario').hasErrors).toBe(false);

    const parsed = formDefinitionSchema.parse(definition);
    expect(validateSubmission(parsed, { name: 'otra' })).toMatchObject({ success: false });
    expect(validateSubmission(parsed, { name: 'ba' })).toMatchObject({ success: true });

    const outsider = updateField(definition, 'field-1', (current) => setFieldDefaultValue(current, 'mza'));
    expect(collectDefinitionEditorErrors(outsider, 'Formulario').fields['field-1']?.defaultValue).toMatch(/no está en el catálogo/);
  });

  it('detecta opciones duplicadas, sin etiqueta y sin valor', () => {
    const withOptions = (options: { label: string; value: string }[]) =>
      collectDefinitionEditorErrors(
        updateField(baseDefinition(), 'field-1', (current) => ({ ...changeFieldType(current, 'select'), options })),
        'Formulario',
      ).fields['field-1']?.options;

    expect(withOptions([{ label: 'Sí', value: 'si' }, { label: 'No', value: 'si' }])).toMatch(/duplicados: si/);
    expect(withOptions([{ label: 'Sí', value: 'si' }, { label: 'No', value: ' si ' }])).toMatch(/duplicados: si/);
    expect(withOptions([{ label: '  ', value: 'si' }])).toMatch(/sin etiqueta/);
    expect(withOptions([{ label: 'Sí', value: '' }])).toMatch(/sin valor interno/);
    expect(withOptions([{ label: 'Sí', value: 'si' }])).toBeUndefined();
  });
});

describe('configuración general del formulario', () => {
  it('exige la clave de tipificación en definiciones v2', () => {
    const errors = collectDefinitionEditorErrors({ ...baseDefinition(), tipificationKey: '   ' }, 'Formulario');
    expect(errors.tipificationKey).toMatch(/obligatoria/);
    expect(errors.hasErrors).toBe(true);
  });

  it('rechaza valores iniciales que no cumplen el tipo o las reglas del campo', () => {
    const email = updateField(baseDefinition(), 'field-1', (current) => ({
      ...changeFieldType(current, 'email'),
      defaultValue: 'no-es-un-email',
    }));
    expect(collectDefinitionEditorErrors(email, 'Formulario').fields['field-1']?.defaultValue).toMatch(/email válido/);

    const requiredCheckbox = updateField(baseDefinition(), 'field-1', (current) => ({
      ...changeFieldType(current, 'checkbox'),
      defaultValue: false,
      rules: { required: true },
    }));
    expect(collectDefinitionEditorErrors(requiredCheckbox, 'Formulario').fields['field-1']?.defaultValue).toMatch(/obligatorio/);

    const invalidDate = updateField(baseDefinition(), 'field-1', (current) => ({
      ...changeFieldType(current, 'date'),
      defaultValue: '2026-02-30',
    }));
    expect(collectDefinitionEditorErrors(invalidDate, 'Formulario').fields['field-1']?.defaultValue).toMatch(/fecha válida/);
  });
});

describe('campos de archivos', () => {
  it('crea un file upload con límites válidos y marca los inconsistentes', () => {
    let definition = updateField(baseDefinition(), 'field-1', (current) => changeFieldType(current, 'fileUpload'));
    definition = updateField(definition, 'field-1', (current) => ({ ...current, minFiles: 1, maxFiles: 3 }));

    expect(collectDefinitionEditorErrors(definition, 'Formulario').hasErrors).toBe(false);
    expect(contractErrors(definition)).toEqual([]);

    const inverted = updateField(definition, 'field-1', (current) => ({ ...current, minFiles: 4, maxFiles: 2 }));
    expect(collectDefinitionEditorErrors(inverted, 'Formulario').fields['field-1']?.files).toMatch(/no puede superar/);

    const outOfRange = updateField(definition, 'field-1', (current) => ({ ...current, maxFiles: 9 }));
    expect(collectDefinitionEditorErrors(outOfRange, 'Formulario').fields['field-1']?.files).toMatch(/entre 1 y 5/);
  });
});

describe('campos de solo lectura', () => {
  it('marca un campo como solo lectura y conserva su valor por defecto', () => {
    let definition = updateField(baseDefinition(), 'field-1', (current) => setFieldReadOnly(current, true));
    definition = updateField(definition, 'field-1', (current) => setFieldDefaultValue(current, 'Sucursal Centro'));

    expect(findField(definition, 'field-1').readOnly).toBe(true);
    expect(collectDefinitionEditorErrors(definition, 'Formulario').hasErrors).toBe(false);
    expect(contractErrors(definition)).toEqual([]);

    const off = updateField(definition, 'field-1', (current) => setFieldReadOnly(current, false));
    expect('readOnly' in findField(off, 'field-1')).toBe(false);
  });

  it('exige un valor por defecto cuando el campo es obligatorio', () => {
    let definition = updateField(baseDefinition(), 'field-1', (current) => setFieldReadOnly(current, true));
    definition = updateField(definition, 'field-1', (current) => setFieldRule(current, 'required', true));

    expect(collectDefinitionEditorErrors(definition, 'Formulario').fields['field-1']?.readOnly).toMatch(/valor por defecto/);
    expect(contractErrors(definition).join(' ')).toMatch(/necesita un valor por defecto/);
  });

  it('no admite solo lectura sobre campos de archivos', () => {
    const definition = updateField(baseDefinition(), 'field-1', (current) => ({
      ...changeFieldType(current, 'fileUpload'),
      readOnly: true,
    }));

    expect(collectDefinitionEditorErrors(definition, 'Formulario').fields['field-1']?.readOnly).toMatch(/no admite solo lectura/);
    expect(contractErrors(definition).join(' ')).toMatch(/no admite solo lectura/);
  });

  it('ignora lo que envía el cliente y persiste el valor declarado', () => {
    let definition = updateField(baseDefinition(), 'field-1', (current) => setFieldReadOnly(current, true));
    definition = updateField(definition, 'field-1', (current) => setFieldDefaultValue(current, 'Sucursal Centro'));

    const parsed = formDefinitionSchema.parse(definition);
    expect(validateSubmission(parsed, { name: 'Valor manipulado' })).toMatchObject({
      success: true,
      data: { name: 'Sucursal Centro' },
    });
  });

  it('mantiene el valor declarado en las celdas de solo lectura de una grilla', () => {
    const { definition, containerId, cellId } = withRepeater();
    let updated = updateField(definition, cellId, (current) => setFieldReadOnly(current, true));
    updated = updateField(updated, cellId, (current) => setFieldDefaultValue(current, 'fijo'));
    const container = updated.containers.find((entry) => entry.id === containerId)!;
    const cell = findField(updated, cellId);

    const parsed = formDefinitionSchema.parse(updated);
    expect(
      validateSubmission(parsed, { name: 'Ana', [container.fieldName!]: [{ [cell.fieldName]: 'manipulado' }] }),
    ).toMatchObject({ success: true, data: { [container.fieldName!]: [{ [cell.fieldName]: 'fijo' }] } });
  });
});

describe('reglas de longitud y expresiones regulares', () => {
  it('permite configurar longitudes en todos los campos de texto', () => {
    for (const type of ['email', 'phone', 'alphabetic', 'alphanumeric'] as const) {
      const definition = updateField(baseDefinition(), 'field-1', (current) => {
        const retyped = changeFieldType(current, type);
        return setFieldRule(setFieldRule(retyped, 'minLength', 3), 'maxLength', 20);
      });
      expect(collectDefinitionEditorErrors(definition, 'Formulario').fields['field-1']).toBeUndefined();
      expect(contractErrors(definition)).toEqual([]);
    }
  });

  it('marca longitudes invertidas, no enteras y regex inválidas', () => {
    const inverted = updateField(baseDefinition(), 'field-1', (current) =>
      setFieldRule(setFieldRule(current, 'minLength', 9), 'maxLength', 2),
    );
    expect(collectDefinitionEditorErrors(inverted, 'Formulario').fields['field-1']?.length).toMatch(/no puede superar/);

    const fractional = updateField(baseDefinition(), 'field-1', (current) => setFieldRule(current, 'minLength', 2.5));
    expect(collectDefinitionEditorErrors(fractional, 'Formulario').fields['field-1']?.length).toMatch(/enteros/);

    const badRegex = updateField(baseDefinition(), 'field-1', (current) => setFieldRule(current, 'pattern', '([a-z'));
    expect(collectDefinitionEditorErrors(badRegex, 'Formulario').fields['field-1']?.pattern).toMatch(/no es válida/);
    expect(contractErrors(badRegex).join(' ')).toMatch(/expresión regular no es válida/);
  });

  it('descarta reglas de longitud al pasar a un tipo que no las admite', () => {
    const withLength = updateField(baseDefinition(), 'field-1', (current) => setFieldRule(current, 'maxLength', 10));
    const asNumber = updateField(withLength, 'field-1', (current) => changeFieldType(current, 'number'));

    expect(findField(asNumber, 'field-1').rules.maxLength).toBeUndefined();
    expect(collectDefinitionEditorErrors(asNumber, 'Formulario').hasErrors).toBe(false);
  });
});

describe('editor de condiciones', () => {
  it('no ofrece celdas de grilla como campos candidatos', () => {
    const { definition, cellId } = withRepeater();
    const candidates = otherFields(definition, 'field-1');

    expect(candidates.map((candidate) => candidate.id)).not.toContain(cellId);
    expect(candidates).toHaveLength(0);
  });

  it('guarda varias reglas con lógica any y operadores de inclusión', () => {
    let definition = addField(baseDefinition(), 'container-1');
    const target = lastField(definition.containers[0]!);
    definition = updateField(definition, 'field-1', (current) => ({
      ...changeFieldType(current, 'select'),
      options: [
        { label: 'Sí', value: 'si' },
        { label: 'No', value: 'no' },
      ],
    }));
    definition = updateField(definition, target.id, (current) => toggleFieldCondition(current, 'visible', true, 'field-1'));
    definition = updateField(definition, target.id, (current) =>
      setFieldCondition(current, 'visible', {
        logic: 'any',
        rules: [
          { fieldId: 'field-1', operator: 'in', value: ['si', 'no'] },
          { fieldId: 'field-1', operator: 'notEmpty' },
        ],
      }),
    );

    const condition = findField(definition, target.id).conditions?.visible;
    expect(condition?.logic).toBe('any');
    expect(condition?.rules).toHaveLength(2);
    expect(collectDefinitionEditorErrors(definition, 'Formulario').hasErrors).toBe(false);
    expect(contractErrors(definition)).toEqual([]);
  });

  it('agrega reglas y reporta las que quedan incompletas', () => {
    let definition = addField(baseDefinition(), 'container-1');
    const target = lastField(definition.containers[0]!);
    definition = updateField(definition, target.id, (current) => toggleFieldCondition(current, 'visible', true, 'field-1'));

    const withTwoRules = updateField(definition, target.id, (current) =>
      setFieldCondition(current, 'visible', addConditionRule(current.conditions!.visible!, 'field-1')),
    );
    expect(findField(withTwoRules, target.id).conditions?.visible?.rules).toHaveLength(2);
    expect(collectDefinitionEditorErrors(withTwoRules, 'Formulario').fields[target.id]?.conditions).toMatch(/valor esperado/);

    const missingList = updateField(definition, target.id, (current) =>
      setFieldCondition(current, 'visible', { logic: 'all', rules: [{ fieldId: 'field-1', operator: 'in', value: [] }] }),
    );
    expect(collectDefinitionEditorErrors(missingList, 'Formulario').fields[target.id]?.conditions).toMatch(/al menos un valor/);

    const unknownField = updateField(definition, target.id, (current) =>
      setFieldCondition(current, 'visible', { logic: 'all', rules: [{ fieldId: 'inexistente', operator: 'notEmpty' }] }),
    );
    expect(collectDefinitionEditorErrors(unknownField, 'Formulario').fields[target.id]?.conditions).toMatch(/inexistente/);
  });

  it('rechaza condiciones declaradas dentro de una grilla', () => {
    const { definition, cellId } = withRepeater();
    const withCondition = updateField(definition, cellId, (current) => ({
      ...current,
      conditions: { visible: { logic: 'all', rules: [{ fieldId: 'field-1', operator: 'notEmpty' }] } },
    }));

    expect(collectDefinitionEditorErrors(withCondition, 'Formulario').fields[cellId]?.conditions).toMatch(/no admiten condiciones/);
    expect(contractErrors(withCondition).join(' ')).toMatch(/no admiten condiciones/);
  });
});

describe('claves de payload', () => {
  it('aísla las claves de cada grilla pero las mantiene únicas en el primer nivel', () => {
    const { definition, containerId, cellId } = withRepeater();
    const cellName = findField(definition, cellId).fieldName;

    // La misma clave puede repetirse entre una celda de grilla y un campo suelto.
    const reused = updateField(definition, 'field-1', (current) => ({ ...current, fieldName: cellName }));
    expect(collectDefinitionEditorErrors(reused, 'Formulario').hasErrors).toBe(false);

    // La clave de la grilla sí compite con la de los campos de primer nivel.
    const collides = updateContainer(definition, containerId, (current) => ({ ...current, fieldName: 'name' }));
    expect(collectDefinitionEditorErrors(collides, 'Formulario').containers[containerId]?.fieldName).toMatch(/ya se usa/);
  });
});
