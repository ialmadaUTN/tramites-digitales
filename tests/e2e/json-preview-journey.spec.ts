import { expect, test } from '@playwright/test';
import { deleteE2eForm } from './support/supabase-cleanup';

/**
 * Recorrido de la vista JSON del CMS: solo vive del lado del cliente (no
 * guarda nada distinto ni pasa por el BFF), pero necesita el bundle real de
 * `@tramites/form-contracts` corriendo bajo webpack — que es exactamente lo
 * que un test unitario con mocks no puede probar. Cubre las 8 aristas
 * pedidas: la pestaña existe, el JSON sale formateado, se actualiza en vivo,
 * se puede copiar, refleja la definición normalizada, informa errores de
 * validación (de campo y estructurales) con claridad, y es de solo lectura.
 */

test.beforeEach(async ({ context }) => {
  // Chromium exige el permiso explícito para que `navigator.clipboard` ande
  // fuera de un gesto de usuario simulado por CDP.
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:3000' });
});

let createdFormId: string | undefined;

test.afterEach(async () => {
  const formId = createdFormId;
  createdFormId = undefined;
  if (formId) await deleteE2eForm(formId);
});

test('la vista JSON muestra la definición normalizada, se actualiza en vivo, se copia y avisa los errores', async ({ page }) => {
  const formName = `E2E JSON ${Date.now()}`;

  await page.goto('/');
  await expect(page.locator('.form-item').first()).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Nuevo formulario', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Estructura del Formulario' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Formulario creado')).toBeVisible({ timeout: 20_000 });

  const hostHref = await page.getByRole('link', { name: 'Abrir Host' }).getAttribute('href');
  createdFormId = hostHref!.slice('/host/'.length);

  await page.locator('.form-group').filter({ hasText: 'Nombre interno (gestión)' }).locator('input').fill(formName);

  // --- 1) Existe la pestaña JSON, y 2) el JSON sale formateado/indentado ---
  const jsonTab = page.getByRole('button', { name: 'JSON' });
  await jsonTab.click();
  const json = page.getByLabel('JSON de la definición del formulario');
  // El aviso de errores es propio del panel (`.json-preview-errors`): la
  // página tiene otro `role=alert` global para notificaciones (p. ej. "Formulario
  // creado"), así que buscarlo sin acotar matchea ese y no el del panel.
  const panelAlert = page.locator('.json-preview-errors');
  await expect(json).toBeVisible();
  await expect(json).toContainText('"title": "Nuevo formulario"');
  // Indentado: la clave no arranca pegada al margen.
  expect(await json.textContent()).toContain('  "title"');
  // El formulario nuevo ya es válido, así que no debería haber ningún aviso.
  await expect(panelAlert).toHaveCount(0);

  // --- 5) Es la definición normalizada, no un espejo del formulario tal cual está en pantalla ---
  // `columns` no se declaró en el contenedor inicial: el JSON tiene que traer
  // igual el default (1) que aplicaría `formDefinitionSchema` al guardar.
  await expect(json).toContainText('"columns": 1');

  // --- 3) Se actualiza en tiempo real al editar la definición ---
  await page.getByRole('button', { name: 'Estructura' }).click();
  await page.locator('.form-group').filter({ hasText: 'Título visible al usuario' }).locator('input').fill('Solicitud E2E JSON');
  await jsonTab.click();
  await expect(json).toContainText('"title": "Solicitud E2E JSON"');
  await expect(json).not.toContainText('"title": "Nuevo formulario"');

  // --- 4) Permite copiar el contenido ---
  await page.getByRole('button', { name: /Copiar JSON/ }).click();
  await expect(page.getByText('¡Copiado!')).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(JSON.parse(copied)).toMatchObject({ title: 'Solicitud E2E JSON' });

  // --- 7) No se puede editar el JSON desde acá ---
  // Acotado a la tarjeta del panel: el encabezado del workspace (Nombre
  // interno, Título, etc.) sigue montado detrás y sí tiene textboxes propios.
  const jsonPanel = page.locator('.card').filter({ has: json });
  expect(await json.getAttribute('contenteditable')).not.toBe('true');
  await expect(jsonPanel.getByRole('textbox')).toHaveCount(0);

  // --- 6a) Informa un error de campo con el mismo texto que "Estructura" ---
  await page.getByRole('button', { name: 'Estructura' }).click();
  const titleInput = page.locator('.form-group').filter({ hasText: 'Título visible al usuario' }).locator('input');
  await titleInput.fill('');
  await jsonTab.click();
  await expect(panelAlert).toBeVisible();
  await expect(panelAlert).toContainText('El título es obligatorio');
  // El panel no se queda en blanco: sigue mostrando el mejor esfuerzo del JSON.
  await expect(json).toBeVisible();

  await page.getByRole('button', { name: 'Estructura' }).click();
  await titleInput.fill('Solicitud E2E JSON');

  // --- 6b) Informa la completitud estructural (P2): sin contenedores, el
  // schema base de todos modos acepta `containers: []`, así que si el panel
  // no sumara este aviso se quedaría mudo justo cuando Publicar está bloqueado.
  await page.locator('.container-editor').first().getByRole('button', { name: 'Eliminar Contenedor' }).click();
  await jsonTab.click();
  await expect(panelAlert).toContainText('El formulario debe tener al menos un contenedor');
});
