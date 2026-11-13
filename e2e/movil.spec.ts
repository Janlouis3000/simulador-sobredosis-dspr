// Teléfono (400 px): el caso completo sin desplazamiento horizontal y con objetivos táctiles grandes.
import { expect, test } from '@playwright/test';
import { jugarHastaInforme, vigilarConsola } from './util';

const sinScrollLateral = async (page: import('@playwright/test').Page, donde: string) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth), donde).toBeLessThanOrEqual(400);

test('caso 2 completo a 400 px', async ({ page }) => {
  const errores = vigilarConsola(page);
  await page.goto('arbol.html');
  await sinScrollLateral(page, 'menú');
  await page.getByRole('button', { name: 'Jugar' }).click();
  await page.getByRole('button', { name: 'Escoger escenario' }).click();
  await sinScrollLateral(page, 'escenarios');
  await page.getByRole('button', { name: /^Pastilla falsa/ }).click();
  await sinScrollLateral(page, 'modo y perfil');
  await page.getByRole('button', { name: 'Comenzar' }).click();
  await sinScrollLateral(page, 'aviso');
  for (const n of ['Continuar', 'Continuar']) await page.getByRole('button', { name: n }).click();
  for (const n of [/Mirar rápido/, /frotarle el centro/, /mirar el pecho/, 'Continuar', /^Llamar al 9-1-1 y poner/]) await page.getByRole('button', { name: n }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await sinScrollLateral(page, 'demostración');
  // La escena 3D cabe en la pantalla, encima de las opciones.
  const escena = await page.locator('.escena3d').boundingBox();
  expect(escena && escena.x >= 0 && escena.x + escena.width <= 400).toBe(true);
  // Botones de al menos 44 px de alto (WCAG 2.2 pide 24 px como mínimo), incluidos los de la escena.
  const altos = await page.locator('main button').evaluateAll((bs) => bs.map((b) => b.getBoundingClientRect().height));
  expect(Math.min(...altos)).toBeGreaterThanOrEqual(44);
  await jugarHastaInforme(page);
  await sinScrollLateral(page, 'informe');
  expect(errores).toEqual([]);
});
