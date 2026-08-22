import { createHmac, timingSafeEqual } from 'node:crypto';
import { containerFields, type FormDefinition, type ExternalVariableValues } from '@tramites/form-contracts';
import { validateExternalVariableValues } from '@tramites/form-contracts/validation';

type ContextClaims = {
  aud: string;
  formId: string;
  exp: number;
  iat?: number;
  variables: Record<string, unknown>;
};

function decodePart(value: string): unknown {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
}

function referencedExternalVariables(definition: FormDefinition): Set<string> {
  const names = new Set<string>();
  const visit = (group: FormDefinition['conditions'] | FormDefinition['containers'][number]['conditions'] | FormDefinition['containers'][number]['fields'][number]['conditions'] | undefined) => {
    if (!group) return;
    for (const condition of Object.values(group)) {
      const walk = (node: typeof condition) => {
        if (!node) return;
        for (const rule of node.rules) {
          if (rule.source?.kind === 'external') names.add(rule.source.variable);
        }
        for (const child of node.groups ?? []) walk(child);
      };
      walk(condition);
    }
  };
  visit(definition.conditions);
  for (const container of definition.containers) {
    visit(container.conditions);
    for (const field of containerFields(container)) visit(field.conditions);
  }
  return names;
}

export function requiresTrustedContext(definition: FormDefinition): boolean {
  const trusted = new Set((definition.externalVariables ?? []).filter((variable) => variable.trust === 'trusted').map((variable) => variable.name));
  return [...referencedExternalVariables(definition)].some((name) => trusted.has(name));
}

export function verifyContextToken(token: string | undefined, formId: string, definition: FormDefinition): ExternalVariableValues {
  if (!requiresTrustedContext(definition)) return {};
  if (!token) throw new Error('El contexto firmado es obligatorio para este formulario');
  const secret = process.env.FORM_CONTEXT_JWT_SECRET;
  if (!secret) throw new Error('FORM_CONTEXT_JWT_SECRET no está configurado');
  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature) throw new Error('El contexto firmado no tiene un formato válido');
  let header: { alg?: string; typ?: string };
  let claims: ContextClaims;
  try {
    header = decodePart(encodedHeader) as typeof header;
    claims = decodePart(encodedPayload) as ContextClaims;
  } catch {
    throw new Error('El contexto firmado no tiene un formato válido');
  }
  if (!header || typeof header !== 'object' || header.alg !== 'HS256' || header.typ !== 'JWT') throw new Error('El contexto firmado usa un algoritmo no permitido');
  const expected = createHmac('sha256', secret).update(`${encodedHeader}.${encodedPayload}`).digest();
  const actual = Buffer.from(encodedSignature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('La firma del contexto no es válida');
  if (!claims || typeof claims !== 'object' || claims.aud !== 'tramites-bff' || claims.formId !== formId) throw new Error('El contexto firmado no corresponde al formulario');
  if (!Number.isFinite(claims.exp) || claims.exp <= Math.floor(Date.now() / 1000)) throw new Error('El contexto firmado expiró');
  if (!claims.variables || typeof claims.variables !== 'object' || Array.isArray(claims.variables)) throw new Error('El contexto firmado no contiene un mapa de variables válido');
  const result = validateExternalVariableValues(definition, claims.variables);
  if (!result.success) throw new Error(Object.values(result.errors).join('; '));
  return result.data;
}
