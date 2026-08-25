import { expect, test } from '@playwright/test';
import { deleteE2eForm, insertSubmissionDirectly } from './support/supabase-cleanup';

/**
 * Este spec no es un recorrido de usuario, y por eso vive aparte.
 *
 * La pausa no puede validarse de forma atómica en el BFF: entre el chequeo de
 * disponibilidad y el insert hay varias operaciones de I/O. Por eso la decisión
 * final la toma un trigger dentro de la misma transacción, y esa garantía sólo
 * se puede comprobar contra una base real: hay que **saltear el BFF** y escribir
 * directo contra PostgREST. Ningún test unitario puede afirmar esto, porque lo
 * que se verifica es justamente que la regla no dependa del servicio.
 *
 * Corre con el mismo Supabase que el resto de los E2E y se saltea igual que
 * ellos cuando no hay credenciales.
 */

const BFF = process.env.NEXT_PUBLIC_BFF_URL ?? 'http://localhost:3001/api/v1';

let createdFormId: string | undefined;

test.afterEach(async () => {
  const formId = createdFormId;
  createdFormId = undefined;
  if (formId) await deleteE2eForm(formId);
});

test('un formulario pausado rechaza el insert aunque se saltee el BFF', async ({ request }) => {
  const definition = {
    schemaVersion: 2,
    tipificationKey: 'generic@v1',
    title: 'Guard de pausa',
    submitLabel: 'Enviar',
    containers: [{
      id: 'c1',
      title: 'Uno',
      kind: 'section',
      columns: 1,
      fields: [{ id: 'f1', fieldName: 'campo', type: 'text', label: 'Campo', width: 'full', rules: {} }],
    }],
  };

  const created = await request.post(`${BFF}/forms`, {
    data: { name: `E2E guard pausa ${Date.now()}`, definition },
  });
  expect(created.ok()).toBe(true);
  const { id } = (await created.json()) as { id: string };
  createdFormId = id;

  expect((await request.post(`${BFF}/forms/${id}/publish`)).ok()).toBe(true);
  expect((await request.post(`${BFF}/forms/${id}/pause`)).ok()).toBe(true);

  // Escritura directa contra PostgREST: si el guard viviera sólo en el BFF,
  // esta submission entraría sobre un formulario que está fuera de circulación.
  const direct = await insertSubmissionDirectly(id, `guard-${Date.now()}`);

  expect(direct.status).toBeGreaterThanOrEqual(400);
  expect(direct.body).toContain('no está disponible');

  // Y al reactivarlo, el mismo insert pasa: el guard bloquea por la pausa y no
  // por otra restricción del esquema.
  expect((await request.post(`${BFF}/forms/${id}/resume`)).ok()).toBe(true);
  const afterResume = await insertSubmissionDirectly(id, `guard-ok-${Date.now()}`);
  expect(afterResume.status).toBeLessThan(300);
});
