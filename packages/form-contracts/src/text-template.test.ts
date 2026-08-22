import { describe, expect, it } from 'vitest';
import { resolveTextTemplate, textTemplateError, textTemplateVariables } from './field-rules';

describe('text templates', () => {
  it('extracts unique names and accepts spaces inside delimiters', () => {
    expect(textTemplateVariables('Hola {{ customerName }} {{customerName}}')).toEqual({ variables: ['customerName'] });
  });

  it('rejects malformed or undeclared placeholders', () => {
    expect(textTemplateError('{{}}', ['name'])).toMatch(/inválido/);
    expect(textTemplateError('{{missing}}', ['name'])).toMatch(/no declarada/);
  });

  it('resolves scalar values and keeps false and zero', () => {
    expect(resolveTextTemplate('Cliente {{name}} · Activo {{active}} · Cantidad {{count}}', { name: 'Ignacio', active: false, count: 0 })).toEqual({
      success: true,
      value: 'Cliente Ignacio · Activo false · Cantidad 0',
    });
  });

  it('reports absent and blank values', () => {
    expect(resolveTextTemplate('{{name}}', {})).toMatchObject({ success: false, missing: ['name'] });
    expect(resolveTextTemplate('{{name}}', { name: '  ' })).toMatchObject({ success: false, missing: ['name'] });
  });
});
