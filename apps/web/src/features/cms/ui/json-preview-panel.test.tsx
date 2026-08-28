// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FormDefinition } from '@tramites/form-contracts';
import { collectDefinitionEditorErrors } from '../model/editor-validation';
import { JsonPreviewPanel } from './json-preview-panel';

afterEach(cleanup);

const validDefinition: FormDefinition = {
  title: 'Solicitud de prueba',
  submitLabel: 'Enviar',
  containers: [{
    id: 'c1',
    title: 'Datos',
    columns: 1,
    fields: [{ id: 'f1', fieldName: 'nombre', type: 'text', label: 'Nombre', width: 'full', rules: {} }],
  }],
};

function renderPanel(definition: FormDefinition, name = 'Demo') {
  return render(<JsonPreviewPanel definition={definition} editorErrors={collectDefinitionEditorErrors(definition, name)} />);
}

describe('JsonPreviewPanel', () => {
  it('muestra el JSON formateado e indentado de la definición normalizada', () => {
    renderPanel(validDefinition);
    const pre = screen.getByLabelText('JSON de la definición del formulario');
    // Indentado con 2 espacios, como el resto del panel.
    expect(pre.textContent).toContain('  "title": "Solicitud de prueba"');
    // Normalizado: `columns` sin especificar en otro contenedor tomaría el default,
    // acá se confirma que lo declarado explícitamente se conserva.
    expect(pre.textContent).toContain('"columns": 1');
  });

  it('actualiza el JSON al re-renderizar con una definición distinta', () => {
    const { rerender } = renderPanel(validDefinition);
    expect(screen.getByLabelText('JSON de la definición del formulario').textContent).toContain('Solicitud de prueba');

    const updated: FormDefinition = { ...validDefinition, title: 'Otro título' };
    rerender(<JsonPreviewPanel definition={updated} editorErrors={collectDefinitionEditorErrors(updated, 'Demo')} />);

    const pre = screen.getByLabelText('JSON de la definición del formulario');
    expect(pre.textContent).toContain('Otro título');
    expect(pre.textContent).not.toContain('Solicitud de prueba');
  });

  it('no expone el nombre interno del CMS ni claves fuera del contrato', () => {
    const withExtra = { ...validDefinition, name: 'nombre-interno-cms', secretToken: 'no-deberia-viajar' } as unknown as FormDefinition;
    renderPanel(withExtra);
    const text = screen.getByLabelText('JSON de la definición del formulario').textContent ?? '';
    expect(text).not.toContain('nombre-interno-cms');
    expect(text).not.toContain('secretToken');
    expect(text).not.toContain('no-deberia-viajar');
  });

  it('informa claramente los errores de validación, con los mismos mensajes que el editor', () => {
    const broken: FormDefinition = { ...validDefinition, title: '' };
    renderPanel(broken);
    const alertText = screen.getByRole('alert').textContent ?? '';
    expect(alertText).toContain('El título es obligatorio');
    // El issue crudo de Zod para el mismo campo no debe duplicar el aviso
    // con un texto menos claro (p. ej. "title: Invalid input").
    expect(alertText).not.toContain('Invalid input');
  });

  it('informa errores de contenedores y campos, no solo los del formulario', () => {
    const broken: FormDefinition = {
      ...validDefinition,
      containers: [{ ...validDefinition.containers[0]!, title: '' }],
    };
    renderPanel(broken);
    const alertText = screen.getByRole('alert').textContent ?? '';
    expect(alertText).toContain('El título del contenedor es obligatorio');
  });

  it('cuando el editor no marcó nada, recurre a los issues crudos de Zod', () => {
    // Un título de más de 200 caracteres no lo marca el editor (solo chequea
    // que no esté vacío), pero sí lo rechaza `formDefinitionSchema`. Es el
    // único caso en que el panel debe apoyarse en el fallback de Zod.
    const broken: FormDefinition = { ...validDefinition, title: 'a'.repeat(201) };
    renderPanel(broken);
    const alertText = screen.getByRole('alert').textContent ?? '';
    expect(alertText).toContain('title');
  });

  it('sin errores, no muestra ningún aviso', () => {
    renderPanel(validDefinition);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('es de solo lectura: no hay ningún control para editar el JSON', () => {
    renderPanel(validDefinition);
    const pre = screen.getByLabelText('JSON de la definición del formulario');
    expect(pre.tagName).toBe('PRE');
    expect(pre.getAttribute('contenteditable')).not.toBe('true');
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('permite copiar el JSON al portapapeles', async () => {
    // user-event instala su propio stub de `navigator.clipboard` en `.setup()`;
    // hay que pisarlo después de esa llamada, no antes, o gana el suyo.
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    renderPanel(validDefinition);
    await user.click(screen.getByRole('button', { name: /Copiar JSON/ }));

    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0]![0] as string;
    expect(JSON.parse(copied)).toMatchObject({ title: 'Solicitud de prueba' });
    expect(screen.getByText('¡Copiado!')).toBeTruthy();
  });
});
