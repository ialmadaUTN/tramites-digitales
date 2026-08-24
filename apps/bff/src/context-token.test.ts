import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { formDefinitionSchema } from '@tramites/form-contracts';
import { requiresTrustedContext, verifyContextToken } from './context-token';

const formId = '11111111-1111-4111-8111-111111111111';
const definition = formDefinitionSchema.parse({
  schemaVersion: 3,
  tipificationKey: 'generic@v1',
  externalVariables: [{ name: 'insuranceCode', label: 'Código', type: 'string', trust: 'trusted' }],
  title: 'Contexto', submitLabel: 'Enviar',
  containers: [{ id: 'c1', title: 'Datos', kind: 'section', columns: 1, fields: [{
    id: 'f1', fieldName: 'detail', type: 'text', label: 'Detalle', rules: {},
    conditions: { visible: { logic: 'all', rules: [{ source: { kind: 'external', variable: 'insuranceCode' }, operator: 'equals', value: '2050' }] } },
  }] }],
});

function token(variables: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({ aud: 'tramites-bff', formId, iat: 1, exp: Math.floor(Date.now() / 1000) + 60, variables, ...overrides });
  const signature = createHmac('sha256', 'test-secret').update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

describe('contexto firmado', () => {
  afterEach(() => { delete process.env.FORM_CONTEXT_JWT_SECRET; });

  it('no exige token cuando no hay variables trusted usadas por reglas', () => {
    expect(requiresTrustedContext(formDefinitionSchema.parse({ title: 'Simple', containers: [] }))).toBe(false);
    expect(verifyContextToken(undefined, formId, formDefinitionSchema.parse({ title: 'Simple', containers: [] }))).toEqual({});
  });

  it('no exige token por un bloque informativo, aunque use una variable trusted', () => {
    const informational = formDefinitionSchema.parse({
      schemaVersion: 3,
      tipificationKey: 'generic@v1',
      externalVariables: [{ name: 'mode', label: 'Modo', type: 'string', trust: 'trusted' }],
      title: 'Información', submitLabel: 'Enviar',
      containers: [{ id: 'c1', title: 'Datos', kind: 'section', columns: 1, fields: [], items: [{
        id: 'help', kind: 'textBlock', text: 'Ayuda', conditions: { visible: { logic: 'all', rules: [{ source: { kind: 'external', variable: 'mode' }, operator: 'equals', value: 'x' }] } },
      }] }],
    });
    expect(requiresTrustedContext(informational)).toBe(false);
    expect(verifyContextToken(undefined, formId, informational)).toEqual({});
  });

  it('verifica firma, audiencia, formulario y tipos declarados', () => {
    process.env.FORM_CONTEXT_JWT_SECRET = 'test-secret';
    expect(verifyContextToken(token({ insuranceCode: '2050' }), formId, definition)).toEqual({ insuranceCode: '2050' });
    // La ausencia es un valor de contexto válido: el evaluador aplica la
    // semántica explícita de equals/notEquals/empty al resolver la condición.
    expect(verifyContextToken(token({}), formId, definition)).toEqual({});
    expect(() => verifyContextToken(token({ insuranceCode: 2050 }), formId, definition)).toThrow(/tipo string/);
    expect(() => verifyContextToken(token({ insuranceCode: '2050' }), 'otro', definition)).toThrow(/corresponde/);
    expect(() => verifyContextToken(token({ insuranceCode: '2050' }, { exp: 1 }), formId, definition)).toThrow(/expiró/);
  });

  it('rechaza firmas manipuladas y algoritmos no permitidos', () => {
    process.env.FORM_CONTEXT_JWT_SECRET = 'test-secret';
    const valid = token({ insuranceCode: '2050' });
    const [header, payload] = valid.split('.');
    expect(() => verifyContextToken(`${header}.${payload}.invalid`, formId, definition)).toThrow(/firma/);
  });
});
