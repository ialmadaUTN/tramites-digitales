import { describe, expect, it } from 'vitest';
import type { FormDefinition } from '@tramites/form-contracts';
import { FIELD_NAME_INVALID_MESSAGE } from '@tramites/form-contracts/field-name';
import { collectDefinitionEditorErrors } from './editor-validation';

const definition: FormDefinition = {
  title: 'Demo',
  submitLabel: 'Enviar',
  containers: [
    {
      id: 'c1',
      title: 'Uno',
      columns: 1,
      fields: [
        { id: 'f1', fieldName: '111', type: 'text', label: 'A', width: 'full', rules: {} },
        { id: 'f2', fieldName: 'age', type: 'number', label: 'Edad', width: 'full', rules: {} },
      ],
    },
  ],
};

describe('collectDefinitionEditorErrors', () => {
  it('flags field names that are not simple identifiers', () => {
    const errors = collectDefinitionEditorErrors(definition, 'Nuevo formulario');
    expect(errors.hasErrors).toBe(true);
    expect(errors.fields.f1?.fieldName).toBe(FIELD_NAME_INVALID_MESSAGE);
    expect(errors.fields.f2).toBeUndefined();
  });

  it('flags duplicated field names under both inputs', () => {
    const errors = collectDefinitionEditorErrors({
      ...definition,
      containers: [{
        id: 'c1',
        title: 'Uno',
        columns: 1,
        fields: [
          { id: 'f1', fieldName: 'age', type: 'text', label: 'A', width: 'full', rules: {} },
          { id: 'f2', fieldName: 'age', type: 'number', label: 'Edad', width: 'full', rules: {} },
        ],
      }],
    }, 'Form');
    expect(errors.fields.f1?.fieldName).toMatch(/ya se usa/);
    expect(errors.fields.f2?.fieldName).toMatch(/ya se usa/);
  });

  it('accepts a valid definition', () => {
    const errors = collectDefinitionEditorErrors({
      ...definition,
      containers: [{
        ...definition.containers[0]!,
        fields: [{ id: 'f1', fieldName: 'policyNumber', type: 'text', label: 'Póliza', width: 'full', rules: {} }],
      }],
    }, 'Solicitud');
    expect(errors.hasErrors).toBe(false);
  });
});

/**
 * Completitud estructural en el editor. La distinción que importa: estos
 * problemas **no** bloquean guardar (un borrador es trabajo a medias) pero sí
 * bloquean publicar.
 */
describe('completitud estructural', () => {
  const ok: FormDefinition = {
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

  it('un formulario completo se puede guardar y publicar', () => {
    const errors = collectDefinitionEditorErrors(ok, 'Demo');
    expect(errors.hasErrors).toBe(false);
    expect(errors.canPublish).toBe(true);
  });

  it('formulario sin contenedores: se guarda, no se publica', () => {
    const errors = collectDefinitionEditorErrors({ ...ok, containers: [] }, 'Demo');
    expect(errors.hasErrors).toBe(false);
    expect(errors.canPublish).toBe(false);
    expect(errors.structure).toBe('El formulario debe tener al menos un contenedor');
  });

  it('contenedor vacío: marca ese contenedor con el mensaje del ticket', () => {
    const errors = collectDefinitionEditorErrors(
      { ...ok, containers: [{ ...ok.containers[0]!, fields: [] }] },
      'Demo',
    );
    expect(errors.hasErrors).toBe(false);
    expect(errors.canPublish).toBe(false);
    expect(errors.containers.c1?.fields).toBe('El contenedor debe tener al menos un campo');
  });

  it('grilla sin columnas: habla de columnas, no de campos', () => {
    const errors = collectDefinitionEditorErrors({
      ...ok,
      containers: [{ id: 'r1', title: 'Grilla', kind: 'repeater', fieldName: 'filas', columns: 1, fields: [] }],
    }, 'Demo');
    expect(errors.canPublish).toBe(false);
    expect(errors.containers.r1?.fields).toBe('La grilla necesita al menos una columna');
  });

  it('marca solo el contenedor vacío y deja limpio al que tiene campos', () => {
    const errors = collectDefinitionEditorErrors({
      ...ok,
      containers: [ok.containers[0]!, { id: 'c2', title: 'Vacía', kind: 'section', columns: 1, fields: [] }],
    }, 'Demo');
    expect(errors.containers.c1).toBeUndefined();
    expect(errors.containers.c2?.fields).toBe('El contenedor debe tener al menos un campo');
  });

  it('un campo mal definido sí bloquea guardar, además de publicar', () => {
    // La separación no debe aflojar las validaciones que ya existían.
    const errors = collectDefinitionEditorErrors({
      ...ok,
      containers: [{ ...ok.containers[0]!, fields: [{ id: 'f1', fieldName: '111', type: 'text', label: 'A', width: 'full', rules: {} }] }],
    }, 'Demo');
    expect(errors.hasErrors).toBe(true);
    expect(errors.canPublish).toBe(false);
  });
});
