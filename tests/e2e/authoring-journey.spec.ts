import { expect, test, type Page } from '@playwright/test';
import { deleteE2eForm, latestE2eSubmissionPayload } from './support/supabase-cleanup';

/**
 * Recorrido completo de autoría: armar un formulario en el CMS, publicarlo y
 * completarlo en el host federado.
 *
 * Es lo único que los tests unitarios no pueden verificar: que el contrato, el
 * CMS, el BFF, la base y el micro-frontend federado se pongan de acuerdo sobre
 * la misma definición. Las reglas de validación en sí ya están cubiertas por
 * las tablas de `packages/form-contracts/src/rules.test.ts`; acá solo se
 * comprueba que el recorrido existe y que lo publicado es lo que se renderiza.
 */

/** El CMS no asocia sus `<label>` con los controles, así que buscamos por grupo. */
function formGroup(page: Page, labelText: string | RegExp) {
  return page.locator('.form-group').filter({ hasText: labelText }).first();
}

/** El editor del campo N-ésimo del primer contenedor. */
function fieldEditor(page: Page, index: number) {
  return page.locator('.field-editor').nth(index);
}

let createdFormId: string | undefined;

test.afterEach(async () => {
  const formId = createdFormId;
  createdFormId = undefined;
  if (formId) await deleteE2eForm(formId);
});

test('un formulario creado en el CMS se publica y se completa en el host', async ({ page }) => {
  const formName = `E2E autoría ${Date.now()}`;

  await page.goto('/');
  // El CMS es un client component: hasta que no hidrata, el click se pierde en
  // silencio (el botón existe y es clickeable, pero no hay handler todavía).
  // La lista poblada es la señal de que ya hidrató y de que el fetch terminó.
  await expect(page.locator('.form-item').first()).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Nuevo formulario', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Estructura del Formulario' })).toBeVisible({ timeout: 20_000 });
  // `createForm` muestra el editor antes de que resuelva `getDraft`, y esa
  // respuesta pisa `name` y `definition`. Hasta que no aparece el aviso de
  // creado, lo que se escriba se pierde.
  await expect(page.getByText('Formulario creado')).toBeVisible({ timeout: 20_000 });

  // Registramos el ID apenas se crea, para que afterEach también pueda limpiar
  // si una aserción posterior falla.
  const hostHref = await page.getByRole('link', { name: 'Abrir Host' }).getAttribute('href');
  expect(hostHref).toMatch(/^\/host\/[0-9a-f-]{36}$/);
  createdFormId = hostHref!.slice('/host/'.length);

  // --- Datos generales -----------------------------------------------------
  await formGroup(page, 'Nombre interno (gestión)').locator('input').fill(formName);
  await formGroup(page, 'Título visible al usuario').locator('input').fill('Solicitud de prueba');

  // --- Campo 1: obligatorio ------------------------------------------------
  const nombre = fieldEditor(page, 0);
  await nombre.locator('.form-group').filter({ hasText: 'Etiqueta visible (Label)' }).locator('input').fill('Nombre completo');
  await nombre.getByLabel('Obligatorio').check();

  // --- Contexto externo y bloque informativo ------------------------------
  await page.getByRole('button', { name: /Agregar variable externa/ }).click();
  await page.getByRole('button', { name: /Agregar variable externa/ }).click();
  const trustedVariable = page.locator('.form-group').filter({ hasText: 'variable2' }).first();
  await trustedVariable.locator('select').nth(1).selectOption('trusted');
  await page.getByRole('button', { name: /Agregar bloque informativo/ }).first().click();
  const contextualBlock = fieldEditor(page, 1);
  await contextualBlock.locator('.form-group').filter({ hasText: 'Título' }).locator('input').fill('Información contextual');
  await contextualBlock.locator('.form-group').filter({ hasText: 'Texto' }).locator('textarea').fill('Visible para el contexto firmado');
  await contextualBlock.getByLabel('Visibilidad condicional').check();
  await contextualBlock.locator('.condition-rule').locator('select').first().selectOption('external:variable1');
  await contextualBlock.locator('.condition-rule').locator('input').fill('2050');

  // --- Campo 2: solo lectura con valor fijo --------------------------------
  await page.getByRole('button', { name: /Agregar Campo a este Contenedor/ }).first().click();
  const sucursal = fieldEditor(page, 2);
  await sucursal.locator('.form-group').filter({ hasText: 'Etiqueta visible (Label)' }).locator('input').fill('Sucursal');
  await sucursal.locator('.form-group').filter({ hasText: 'Nombre de clave de payload' }).locator('input').fill('sucursal');
  await sucursal.locator('.form-group').filter({ hasText: 'Valor inicial por defecto' }).locator('input').fill('Centro');
  await sucursal.getByLabel('Solo lectura').check();
  await sucursal.getByLabel('Inclusión condicional').check();
  await sucursal.locator('.condition-rule').locator('select').first().selectOption('external:variable2');
  await sucursal.locator('.condition-rule').locator('input').fill('9999');

  // El editor no debería estar reportando ningún problema antes de guardar.
  await expect(page.locator('.field-error')).toHaveCount(0);

  // --- Guardar y publicar --------------------------------------------------
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Borrador guardado')).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Publicar' }).click();
  await expect(page.getByText('Versión publicada')).toBeVisible({ timeout: 20_000 });

  // --- Completar en el host federado ---------------------------------------
  await page.goto(hostHref!);
  await expect(page.getByRole('heading', { name: 'Solicitud de prueba' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Información contextual')).toBeVisible();

  // El campo de solo lectura llega con su valor y no se puede editar.
  const readOnlyInput = page.getByLabel(/Sucursal/);
  await expect(readOnlyInput).toHaveValue('Centro');
  await expect(readOnlyInput).toHaveAttribute('readonly', '');

  // Enviar vacío tiene que frenar en la validación del campo obligatorio.
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.locator('.field-error').first()).toBeVisible();
  await expect(page.getByText('Gestión recibida')).toHaveCount(0);

  // Con el campo completo, el submission llega al BFF y vuelve el comprobante.
  await page.getByLabel(/Nombre completo/).fill('Ana Pérez');
  await page.getByRole('button', { name: 'Enviar' }).click();

  await expect(page.getByText('Gestión recibida')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Número de submission:/)).toBeVisible();
  const payload = await latestE2eSubmissionPayload(createdFormId!);
  expect(payload).toMatchObject({ name: 'Ana Pérez' });
  expect(payload).not.toHaveProperty('sucursal');
});
