import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type CleanupConfig = {
  url: string;
  key: string;
  schema: string;
};

type FormRow = { id: number };
type SubmissionRow = { payload: Record<string, unknown> };

function readWorkspaceEnv() {
  const values: Record<string, string> = {};

  for (const filename of ['.env.local', '.env']) {
    try {
      const contents = readFileSync(resolve(process.cwd(), filename), 'utf8');
      for (const line of contents.split(/\r?\n/)) {
        const separator = line.indexOf('=');
        if (separator < 1 || line.trimStart().startsWith('#')) continue;
        const name = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
        if (!(name in values)) values[name] = value;
      }
    } catch {
      // CI injecta las variables directamente y no necesita archivos locales.
    }
  }

  return values;
}

function getConfig(): CleanupConfig {
  const fileEnv = readWorkspaceEnv();
  const url = process.env.SUPABASE_URL ?? fileEnv.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY
    ?? process.env.SUPABASE_SERVICE_ROLE_KEY
    ?? fileEnv.SUPABASE_SECRET_KEY
    ?? fileEnv.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Faltan SUPABASE_URL y SUPABASE_SECRET_KEY para limpiar el formulario del E2E');
  }

  return {
    url: url.replace(/\/$/, ''),
    key,
    schema: process.env.SUPABASE_DB_SCHEMA ?? fileEnv.SUPABASE_DB_SCHEMA ?? 'public',
  };
}

function headers(config: CleanupConfig, profile: 'accept' | 'content') {
  return {
    apikey: config.key,
    Authorization: `Bearer ${config.key}`,
    [`${profile === 'accept' ? 'Accept' : 'Content'}-Profile`]: config.schema,
  };
}

async function assertResponse(response: Response, operation: string) {
  if (response.ok) return;
  const details = await response.text();
  throw new Error(`${operation}: Supabase respondió ${response.status}${details ? `: ${details}` : ''}`);
}

/**
 * Elimina un formulario creado por un E2E y las filas que impiden borrarlo.
 * La eliminación de form_versions queda a cargo del cascade de forms.
 */
export async function deleteE2eForm(publicId: string) {
  const config = getConfig();
  const formResponse = await fetch(
    `${config.url}/rest/v1/forms?select=id&public_id=eq.${encodeURIComponent(publicId)}`,
    { headers: headers(config, 'accept') },
  );
  await assertResponse(formResponse, `No se pudo buscar el formulario ${publicId}`);

  const forms = await formResponse.json() as FormRow[];
  const form = forms[0];
  if (!form) return;

  const formFilter = `form_id=eq.${form.id}`;
  const submissionsResponse = await fetch(
    `${config.url}/rest/v1/submissions?${formFilter}`,
    { method: 'DELETE', headers: headers(config, 'content') },
  );
  await assertResponse(submissionsResponse, `No se pudieron borrar las submissions del formulario ${publicId}`);

  // uploads.form_version_id tiene una FK restrictiva; borrarlos antes del
  // formulario permite que también se pueda limpiar un E2E que use adjuntos.
  const uploadsResponse = await fetch(
    `${config.url}/rest/v1/uploads?${formFilter}`,
    { method: 'DELETE', headers: headers(config, 'content') },
  );
  // Algunos proyectos de prueba todavía no exponen la tabla opcional de
  // adjuntos en el schema REST. En ese caso no hay nada que limpiar.
  if (uploadsResponse.status !== 404) {
    await assertResponse(uploadsResponse, `No se pudieron borrar los uploads del formulario ${publicId}`);
  }

  const deleteResponse = await fetch(
    `${config.url}/rest/v1/forms?public_id=eq.${encodeURIComponent(publicId)}`,
    { method: 'DELETE', headers: headers(config, 'content') },
  );
  await assertResponse(deleteResponse, `No se pudo borrar el formulario ${publicId}`);
}

/** Lee la última submission de un formulario de prueba para afirmar el payload limpio. */
export async function latestE2eSubmissionPayload(publicId: string): Promise<Record<string, unknown>> {
  const config = getConfig();
  const formResponse = await fetch(
    `${config.url}/rest/v1/forms?select=id&public_id=eq.${encodeURIComponent(publicId)}`,
    { headers: headers(config, 'accept') },
  );
  await assertResponse(formResponse, `No se pudo buscar el formulario ${publicId}`);
  const forms = await formResponse.json() as FormRow[];
  const form = forms[0];
  if (!form) throw new Error(`No se encontró el formulario ${publicId}`);
  const submissionsResponse = await fetch(
    `${config.url}/rest/v1/submissions?form_id=eq.${form.id}&select=payload&order=created_at.desc&limit=1`,
    { headers: headers(config, 'accept') },
  );
  await assertResponse(submissionsResponse, `No se pudo leer la submission del formulario ${publicId}`);
  const submissions = await submissionsResponse.json() as SubmissionRow[];
  if (!submissions[0]) throw new Error(`No se encontró una submission para ${publicId}`);
  return submissions[0].payload;
}

/**
 * Inserta una submission **directamente** contra PostgREST, sin pasar por el BFF.
 * Es la única forma de comprobar que el guard de disponibilidad vive en el
 * esquema y no en el servicio: si estuviera solo en el BFF, este insert entraría.
 */
export async function insertSubmissionDirectly(
  formPublicId: string,
  idempotencyKey: string,
): Promise<{ status: number; body: string }> {
  const config = getConfig();
  const formResponse = await fetch(
    `${config.url}/rest/v1/forms?select=id,published_version_id&public_id=eq.${encodeURIComponent(formPublicId)}`,
    { headers: headers(config, 'accept') },
  );
  await assertResponse(formResponse, 'Buscar el formulario');
  const [form] = (await formResponse.json()) as Array<{ id: number; published_version_id: number | null }>;
  if (!form) throw new Error(`No existe el formulario ${formPublicId}`);

  const response = await fetch(`${config.url}/rest/v1/submissions`, {
    method: 'POST',
    headers: { ...headers(config, 'content'), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      form_id: form.id,
      form_version_id: form.published_version_id,
      idempotency_key: idempotencyKey,
      payload: {},
    }),
  });

  return { status: response.status, body: await response.text() };
}
