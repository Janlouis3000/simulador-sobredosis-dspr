// Navegador sin WebGL: el simulador con árbol no lo necesita; el clásico sigue funcionando sin la escena 3D.
import { expect, test } from '@playwright/test';
import { entrar, jugarHastaInforme } from './util';

test('árbol: funciona completo sin WebGL', async ({ page }) => {
  await page.goto('arbol.html');
  expect(await page.evaluate(() => !!document.createElement('canvas').getContext('webgl'))).toBe(false);
  await entrar(page);
  // Sin WebGL no hay escena 3D ni iconos: queda la lista de opciones, que es la equivalente accesible.
  await expect(page.locator('.escena3d')).toHaveCount(0);
  await expect(page.locator('#paso-titulo')).toHaveText('Antes de empezar');
  await jugarHastaInforme(page);
  await expect(page.locator('.informe h2')).toHaveText('Resultado de tu intervención');
});

test('clásico: sin WebGL avisa y la simulación sigue con signos y gráficas', async ({ page }) => {
  await page.goto('index.html');
  await page.locator('#case-fentanilo').click();
  await page.getByRole('button', { name: 'Comenzar' }).click();
  await expect(page.locator('#no3d')).toBeVisible();
  await page.locator('#act-call').click();
  await expect(page.locator('#ems')).not.toHaveText('Sin llamar');
});
