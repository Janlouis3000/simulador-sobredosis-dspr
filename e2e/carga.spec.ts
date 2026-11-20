// Carga de la escena 3D del simulador por pasos: los modelos empiezan a bajar al escoger el caso, y mientras no
// llegan se ve "Preparando la escena…" en vez del maniquí de cápsulas. Si no cargan, queda el respaldo.
import { expect, test } from '@playwright/test';
import { entrar, vigilarConsola } from './util';

test('los modelos del caso empiezan a bajar al escoger la tarjeta, antes de Comenzar', async ({ page }) => {
  const glb: string[] = [];
  page.on('request', (r) => { if (r.url().endsWith('.glb')) glb.push(r.url()); });
  await page.goto('arbol.html');
  await page.getByRole('button', { name: 'Jugar' }).click();
  await page.getByRole('button', { name: 'Escoger escenario' }).click();
  expect(glb).toEqual([]); // nada se baja en el menú ni en la lista de escenarios
  await page.getByRole('button', { name: /^Pastilla falsa/ }).click();
  // Personaje y escenario del caso, todavía en la pantalla de modo y perfil.
  await expect.poll(() => glb.length).toBeGreaterThanOrEqual(2);
  expect(glb.some((u) => /persona_a\d/.test(u)), 'personaje del caso 2 (adolescente)').toBe(true);
  expect(glb.some((u) => /escenario_pastillas/.test(u)), 'escenario del caso 2').toBe(true);
  await expect(page.getByRole('button', { name: 'Comenzar' })).toBeVisible();
});

test('mientras bajan los modelos se ve "Preparando la escena…" y no los iconos; después se destapa', async ({ page }) => {
  const errores = vigilarConsola(page);
  // Conexión lenta: cada modelo tarda 4 s en llegar.
  await page.route('**/*.glb', async (r) => { await new Promise((ok) => setTimeout(ok, 4000)); await r.continue(); });
  await page.goto('arbol.html');
  await entrar(page);
  for (const n of ['Continuar', 'Continuar']) await page.getByRole('button', { name: n }).click();
  await page.getByRole('button', { name: /Mirar rápido/ }).click();
  const cortina = page.locator('.cargando-escena');
  await expect(cortina).toBeVisible();
  await expect(cortina.getByRole('status')).toHaveText('Preparando la escena…');
  await expect(page.locator('.marca')).toHaveCount(0);
  // La lista de opciones sigue disponible mientras tanto (teclado y lector de pantalla no esperan a la escena).
  await expect(page.getByRole('button', { name: /frotarle el centro/ })).toBeEnabled();
  await expect(cortina).toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator('.marca')).toHaveCount(3);
  expect(errores).toEqual([]);
});

test('si los modelos no cargan, se quita la cortina y sigue con el respaldo', async ({ page }) => {
  const errores = vigilarConsola(page);
  await page.route('**/*.glb', (r) => r.abort());
  await page.goto('arbol.html');
  await entrar(page);
  for (const n of ['Continuar', 'Continuar']) await page.getByRole('button', { name: n }).click();
  await page.getByRole('button', { name: /Mirar rápido/ }).click();
  await expect(page.locator('.cargando-escena')).toHaveCount(0);
  await expect(page.locator('.marca')).toHaveCount(3);
  // Solo se permiten los avisos de la descarga cancelada a propósito.
  expect(errores.filter((e) => !/Failed to load resource|ERR_FAILED/.test(e))).toEqual([]);
});
