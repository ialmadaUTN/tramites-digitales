import { createHmac } from 'node:crypto';

export function signHostContext(formId: string, variables: Record<string, string | number | boolean>): string | undefined {
  const secret = process.env.FORM_CONTEXT_JWT_SECRET;
  if (!secret) return undefined;
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const now = Math.floor(Date.now() / 1000);
  const payload = encode({ aud: 'tramites-bff', formId, iat: now, exp: now + 300, variables });
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}
