import { expect, test, type Page } from '@playwright/test';
import { deleteE2eForm, latestE2eSubmissionPayload } from './support/supabase-cleanup';

/**
 * Recorrido completo de los bloques FAQ: armarlos en el CMS (agregar, editar,
 * reordenar, eliminar), publicarlos y verificar que en el host se muestran
 * como acordeones accesibles, que no participan de la validación de campos
 * ni terminan en el payload del envío.
 *
 * Es lo único que los tests unitarios no pueden cubrir: que lo que se arma en
 * el editor sea exactamente lo que el runtime federado termina renderizando.
 * Las reglas de validación en sí (pregunta/respuesta obligatorias, texto
 * plano) ya están cubiertas por `editor-validation.test.ts` e `index.test.ts`.
 */

/**
 * El editor del bloque FAQ N-ésimo. A diferencia de `.field-editor` dentro de
 * un contenedor (que también usan los campos y los bloques informativos),
 * `.faq-blocks-list` solo contiene bloques FAQ: no hay ambigüedad de clase
 * acá, así que un índice posicional es estable mientras el propio test sea
 * el único que reordena.
 */
function faqBlockEditor(page: Page, index: number) {
  return page.locator('.faq-blocks-list .field-editor').nth(index);
}

let createdFormId: string | undefined;

test.afterEach(async () => {
  const formId = createdFormId;
  createdFormId = undefined;
  if (formId) await deleteE2eForm(formId);
});

test('un formulario con bloques FAQ se arma, publica y se ve como acordeones en el host', async ({ page }) => {
  const formName = `E2E FAQ ${Date.now()}`;

  await page.goto('/');
  await expect(page.locator('.form-item').first()).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Nuevo formulario', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Estructura del Formulario' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Formulario creado')).toBeVisible({ timeout: 20_000 });

  const hostHref = await page.getByRole('link', { name: 'Abrir Host' }).getAttribute('href');
  expect(hostHref).toMatch(/^\/host\/[0-9a-f-]{36}$/);
  createdFormId = hostHref!.slice('/host/'.length);

  await page.locator('.form-group').filter({ hasText: 'Nombre interno (gestión)' }).locator('input').fill(formName);

  // --- Armar dos bloques FAQ ------------------------------------------------
  // Cada click re-renderiza el editor; se espera el bloque resultante antes
  // de seguir, en vez de encadenar clicks a ciegas (misma razón que en
  // authoring-journey.spec.ts: evita competir contra un layout todavía
  // asentándose bajo CI).
  await page.getByRole('button', { name: /Agregar Bloque FAQ/ }).click();
  await expect(page.locator('.faq-blocks-list .field-editor')).toHaveCount(1);
  const first = faqBlockEditor(page, 0);
  await first.locator('.form-group').filter({ hasText: 'Pregunta / título' }).locator('input').fill('¿Qué documentación necesito?');
  await first.locator('.form-group').filter({ hasText: 'Respuesta / contenido' }).locator('textarea').fill('El DNI y el comprobante de domicilio.');
  // Sin tildar "Mostrar abierto por defecto": tiene que arrancar cerrado en el host.

  await page.getByRole('button', { name: /Agregar Bloque FAQ/ }).click();
  await expect(page.locator('.faq-blocks-list .field-editor')).toHaveCount(2);
  const second = faqBlockEditor(page, 1);
  await second.locator('.form-group').filter({ hasText: 'Pregunta / título' }).locator('input').fill('¿Cuánto tarda la gestión?');
  await second.locator('.form-group').filter({ hasText: 'Respuesta / contenido' }).locator('textarea').fill('Entre 5 y 10 días hábiles.');
  await second.getByLabel('Mostrar abierto por defecto').check();

  // --- Reordenar: el segundo pasa a ser el primero --------------------------
  await second.getByTitle('Mover arriba').click();
  await expect(faqBlockEditor(page, 0)).toContainText('¿Cuánto tarda la gestión?');
  await expect(faqBlockEditor(page, 1)).toContainText('¿Qué documentación necesito?');

  // --- Agregar y eliminar un tercero: el CRUD también se prueba de punta a punta ---
  await page.getByRole('button', { name: /Agregar Bloque FAQ/ }).click();
  await expect(page.locator('.faq-blocks-list .field-editor')).toHaveCount(3);
  await faqBlockEditor(page, 2).getByRole('button', { name: 'Eliminar' }).click();
  await expect(page.locator('.faq-blocks-list .field-editor')).toHaveCount(2);

  // El editor no debería estar reportando ningún problema antes de guardar.
  await expect(page.locator('.field-error')).toHaveCount(0);

  // --- Guardar y publicar ----------------------------------------------------
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Borrador guardado')).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Publicar' }).click();
  await expect(page.getByText('Versión publicada')).toBeVisible({ timeout: 20_000 });

  // --- Verificar los acordeones en el host federado ---------------------------
  await page.goto(hostHref!);
  await expect(page.getByRole('heading', { name: 'Preguntas frecuentes' })).toBeVisible({ timeout: 20_000 });

  const durationTrigger = page.getByRole('button', { name: /¿Cuánto tarda la gestión\?/ });
  const docsTrigger = page.getByRole('button', { name: /¿Qué documentación necesito\?/ });

  // El orden del editor se respeta en el runtime.
  const questions = page.locator('.faq-item .faq-trigger');
  await expect(questions.nth(0)).toContainText('¿Cuánto tarda la gestión?');
  await expect(questions.nth(1)).toContainText('¿Qué documentación necesito?');

  // "Abierto por defecto" se refleja en el estado inicial de cada uno.
  await expect(durationTrigger).toHaveAttribute('aria-expanded', 'true');
  await expect(docsTrigger).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText('Entre 5 y 10 días hábiles.')).toBeVisible();
  await expect(page.getByText('El DNI y el comprobante de domicilio.')).toBeHidden();

  // Click: se abre y cierra independientemente del otro bloque.
  await docsTrigger.click();
  await expect(docsTrigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('El DNI y el comprobante de domicilio.')).toBeVisible();
  await expect(durationTrigger).toHaveAttribute('aria-expanded', 'true');

  // Teclado: Enter sobre el trigger enfocado cierra el acordeón, igual que el click.
  await durationTrigger.focus();
  await page.keyboard.press('Enter');
  await expect(durationTrigger).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText('Entre 5 y 10 días hábiles.')).toBeHidden();

  // aria-controls apunta a un panel real, accesible por su id.
  const controlsId = await docsTrigger.getAttribute('aria-controls');
  expect(controlsId).toBeTruthy();
  await expect(page.locator(`#${controlsId}`)).toBeVisible();

  // --- Enviar: el FAQ no interfiere con el envío ni viaja en el payload ------
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByText('Gestión recibida')).toBeVisible({ timeout: 20_000 });

  const payload = await latestE2eSubmissionPayload(createdFormId!);
  expect(payload).not.toHaveProperty('faqBlocks');
  expect(Object.keys(payload).some((key) => /documentaci[oó]n|gesti[oó]n|pregunta|respuesta/i.test(key))).toBe(false);
});
