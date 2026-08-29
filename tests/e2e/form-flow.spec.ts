import { expect, test } from '@playwright/test';
import { deleteE2eForm } from './support/supabase-cleanup';

const seededFormId = '11111111-1111-4111-8111-111111111111';
let createdFormId: string | undefined;

test.afterEach(async () => {
  const formId = createdFormId;
  createdFormId = undefined;
  if (formId) await deleteE2eForm(formId);
});

test('carga el formulario por ID desde el host federado', async ({ page }) => {
  await page.goto(`/host/${seededFormId}`);
  await expect(page.getByRole('heading', { name: 'Formulario federado' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Denuncia de siniestro' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel('Nombre completo')).toBeVisible();
  await expect(page.getByText(/Hubo testigos/)).toBeVisible();
});

test('el BFF permite el origen público de la preview', async ({ request }) => {
  const response = await request.get('http://localhost:3001/api/v1/forms', {
    headers: { Origin: 'https://tramites-web-preview.onrender.com' },
  });

  expect(response.ok()).toBeTruthy();
  expect(response.headers()['access-control-allow-origin']).toBe('https://tramites-web-preview.onrender.com');
  expect(await response.json()).toEqual(expect.any(Array));
});

test('permite crear un formulario desde el CMS', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Denuncia de siniestro/ })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Nuevo formulario', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Estructura del formulario' })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('input').nth(1)).toHaveValue('Nuevo formulario');

  const hostHref = await page.getByRole('link', { name: 'Abrir Host' }).getAttribute('href');
  expect(hostHref).toMatch(/^\/host\/[0-9a-f-]{36}$/);
  createdFormId = hostHref!.slice('/host/'.length);
});
