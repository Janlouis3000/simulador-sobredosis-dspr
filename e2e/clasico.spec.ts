// Simulador clásico en el build web: carga el modelo del caso aparte y, si falla, sigue con el maniquí.
import { expect, test } from '@playwright/test';
import { vigilarConsola } from './util';

test('carga el modelo GLB del caso como archivo aparte, sin errores (con la política de seguridad)', async ({ page }) => {
  const errores = vigilarConsola(page);
  const glb: string[] = [];
  page.on('request', (r) => { if (r.url().endsWith('.glb')) glb.push(r.url()); });
  await page.goto('index.html');
  expect(glb).toEqual([]); // nada se baja antes de escoger el caso
  await page.locator('#case-pastillas').click();
  await page.getByRole('button', { name: 'Comenzar' }).click();
  await expect(page.locator('#stage canvas')).toBeVisible();
  await expect.poll(() => glb.length).toBeGreaterThan(0);
  await page.waitForTimeout(2000);
  expect(errores).toEqual([]);
});

test('si el modelo 3D no carga, sigue con el maniquí y la simulación funciona', async ({ page }) => {
  const errores = vigilarConsola(page);
  await page.route('**/*.glb', (r) => r.abort());
  await page.goto('index.html');
  await page.locator('#case-fentanilo').click();
  await page.getByRole('button', { name: 'Comenzar' }).click();
  await page.locator('#act-call').click();
  await expect(page.locator('#ems')).not.toHaveText('Sin llamar');
  // Solo se permiten los avisos de la descarga cancelada a propósito.
  expect(errores.filter((e) => !/Failed to load resource|ERR_FAILED/.test(e))).toEqual([]);
});
