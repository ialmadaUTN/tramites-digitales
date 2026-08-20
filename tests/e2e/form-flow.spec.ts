import { expect, test } from '@playwright/test';

const seededFormId = '11111111-1111-4111-8111-111111111111';

test('carga el formulario por ID desde el host federado', async ({ page }) => {
  await page.goto(`/host/${seededFormId}`);
  await expect(page.getByRole('heading', { name: 'Formulario federado' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Denuncia de siniestro' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel('Nombre completo')).toBeVisible();
  await expect(page.getByText(/Hubo testigos/)).toBeVisible();
});

test('permite crear un formulario desde el CMS', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Denuncia de siniestro/ })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Nuevo formulario', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Estructura del formulario' })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('input').nth(1)).toHaveValue('Nuevo formulario');
});
