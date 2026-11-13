// Simulador con árbol (arbol.html, build web): accesibilidad con axe, teclado, foco, reinicio, idioma,
// movimiento reducido, política de seguridad (sin errores en la consola), iframe, menús, iconos sobre la escena 3D
// y modo sin guía.
import { expect, test } from '@playwright/test';
import { entrar, focoEnTitulo, jugarHastaInforme, revisarAccesibilidad, teclado, vigilarConsola } from './util';

test('axe sin violaciones en menús, paso, resumen, demostración, práctica, conversación e informe', async ({ page }) => {
  const errores = vigilarConsola(page);
  await page.goto('arbol.html');
  await revisarAccesibilidad(page, 'menú');
  await page.getByRole('button', { name: 'Controles' }).click();
  await revisarAccesibilidad(page, 'controles');
  await page.getByRole('button', { name: 'Menú principal' }).click();
  await page.getByRole('button', { name: 'Jugar' }).click();
  await revisarAccesibilidad(page, 'pregunta del tutorial');
  await page.getByRole('button', { name: 'Ver el tutorial' }).click();
  await revisarAccesibilidad(page, 'tutorial');
  await page.getByRole('button', { name: 'Escoger escenario' }).click();
  await revisarAccesibilidad(page, 'escenarios');
  await page.getByRole('button', { name: /^Fentanilo/ }).click();
  await revisarAccesibilidad(page, 'modo y perfil');
  await page.getByRole('button', { name: 'Comenzar' }).click();
  await expect(page.locator('.escena3d canvas')).toBeVisible();
  await revisarAccesibilidad(page, 'aviso');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: /Mirar rápido/ }).click();
  await page.getByRole('button', { name: /Echarle agua/ }).click();
  await revisarAccesibilidad(page, 'decisión incorrecta con su explicación y los iconos de la escena');
  for (const n of [/frotarle el centro/, /mirar el pecho/]) await page.getByRole('button', { name: n }).click();
  await expect(page.locator('#paso-titulo')).toHaveText('Resumen: Evaluación');
  await revisarAccesibilidad(page, 'resumen de la fase');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: /^Llamar al 9-1-1 y poner/ }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await revisarAccesibilidad(page, 'demostración de naloxona');
  await page.getByRole('button', { name: 'Omitir demostración' }).click();
  await page.getByRole('button', { name: /^Pulgar en el émbolo/ }).click();
  await revisarAccesibilidad(page, 'práctica de naloxona');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  // Hasta la conversación
  for (let i = 0; i < 60 && !(await page.locator('.dialogo').count()); i++) {
    const t = await page.locator('main button').allInnerTexts();
    const re = [/^Nada: viene/, /^Siguiente$/, /^Introduzco/, /^Dar la naloxona$/, /otra dosis/, /inclinarle la cabeza/, /respiraciones de rescate/, /^Ponerla de lado, con/, /limpiarle la boca/, /^Quedarte a su lado/, /Seguir ayudándole/, /^Continuar$/]
      .find((r) => t.some((x) => r.test(x.trim())));
    if (!re) throw new Error(t.join(' / '));
    await page.locator('main button').filter({ hasText: re }).first().click();
  }
  await revisarAccesibilidad(page, 'conversación al despertar');
  await jugarHastaInforme(page);
  await revisarAccesibilidad(page, 'informe final');
  expect(errores).toEqual([]);
});

test('todo el caso 1 se puede hacer solo con teclado y el foco va al título de cada paso', async ({ page }) => {
  const errores = vigilarConsola(page);
  await page.goto('arbol.html');
  await teclado(page, /^Jugar$/);
  expect(await focoEnTitulo(page)).toBe('¿Ver el tutorial primero?');
  await teclado(page, /^Escoger escenario$/);
  expect(await focoEnTitulo(page)).toBe('Escenarios');
  await teclado(page, /^Fentanilo/);
  expect(await focoEnTitulo(page)).toBe('Escoge el modo');
  await teclado(page, /^Comenzar$/);
  expect(await focoEnTitulo(page)).toBe('Antes de empezar');
  const PREF = [/^Omitir demostración$/, /^(Siguiente|Dar la naloxona|Usar un dispositivo nuevo|Seguir|Continuar)$/,
    /^Pulgar en el émbolo|^Nada: viene|^Introduzco|Hablarle bajo|Eso que sientes|Te entiendo|Estás a salvo/,
    /otra dosis/, /inclinarle la cabeza/, /respiraciones de rescate/, /^Ponerla de lado, con/, /limpiarle la boca/, /^Quedarte a su lado/,
    /hasta que llegue la ambulancia/, /^Llamar al 9-1-1 y poner/, /frotarle el centro/, /mirar el pecho/, /Mirar rápido/, /Seguir ayudándole/];
  let titulos = 0;
  for (let i = 0; i < 90 && !(await page.locator('.informe').count()); i++) {
    const textos = (await page.locator('main button').allInnerTexts()).map((x) => x.trim());
    const re = PREF.find((r) => textos.some((x) => r.test(x)));
    if (!re) throw new Error(`Sin opción: ${textos.join(' / ')}`);
    const objetivo = textos.find((x) => re.test(x)) as string;
    await teclado(page, new RegExp(`^${objetivo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    const foco = await focoEnTitulo(page);
    if (!foco.startsWith('(foco')) titulos++;
    // El foco nunca se pierde en el cuerpo de la página.
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY');
  }
  await expect(page.locator('.informe h2')).toBeFocused();
  expect(titulos).toBeGreaterThan(10);
  expect(errores).toEqual([]);
});

test('menú: tutorial, controles y repaso de la naloxona vuelven al menú', async ({ page }) => {
  await page.goto('arbol.html');
  await page.getByRole('button', { name: 'Tutorial' }).click();
  await expect(page.locator('#pantalla-titulo')).toHaveText('Tutorial');
  await expect(page.locator('.tutorial li')).toHaveCount(5);
  await page.getByRole('button', { name: 'Menú principal' }).click();
  await page.getByRole('button', { name: 'Cómo usar la naloxona' }).click();
  await expect(page.getByText('Paso 1 de 10')).toBeVisible();
  await page.getByRole('button', { name: 'Omitir demostración' }).click();
  await expect(page.getByRole('button', { name: 'Jugar' })).toBeVisible();
  // Los cuatro escenarios con su miniatura; después de ver el tutorial ya no se pregunta por él.
  await page.getByRole('button', { name: 'Tutorial' }).click();
  await page.getByRole('button', { name: 'Escoger escenario' }).click();
  await expect(page.locator('.escenario img')).toHaveCount(4);
  await page.getByRole('button', { name: 'Menú principal' }).click();
  await page.getByRole('button', { name: 'Jugar' }).click();
  await expect(page.locator('#pantalla-titulo')).toHaveText('Escenarios');
});

test('escena 3D: los iconos sobre la persona escogen la opción y la naloxona se ve', async ({ page }) => {
  const errores = vigilarConsola(page);
  await page.goto('arbol.html');
  await entrar(page);
  for (const n of ['Continuar', 'Continuar']) await page.getByRole('button', { name: n }).click();
  await page.getByRole('button', { name: /Mirar rápido/ }).click();
  // Tres opciones, tres iconos; el de la mano en el pecho es "llamarla fuerte y frotarle el pecho".
  await expect(page.locator('.marca')).toHaveCount(3);
  const mano = page.locator('.marca[title^="Llamar a la persona fuerte"]');
  await expect(mano).toBeVisible();
  // Los iconos no se enciman: quedan dentro de la escena y separados entre sí.
  const cajas = await page.locator('.marca').evaluateAll((ms) => ms.map((m) => { const r = m.getBoundingClientRect(); return { x: r.x, y: r.y }; }));
  for (let a = 0; a < cajas.length; a++) for (let b = a + 1; b < cajas.length; b++) {
    const p = cajas[a] as { x: number; y: number }, q = cajas[b] as { x: number; y: number };
    expect(Math.abs(p.x - q.x) >= 44 || Math.abs(p.y - q.y) >= 44, 'iconos separados').toBe(true);
  }
  await mano.click();
  await expect(page.locator('#paso-titulo')).toHaveText('No responde. ¿Qué revisas ahora?');
  // Los iconos repiten la lista: no entran en el orden de Tab ni los anuncia el lector de pantalla.
  expect(await page.locator('.marca').evaluateAll((ms) => ms.every((m) => m.getAttribute('aria-hidden') === 'true' && (m as HTMLElement).tabIndex === -1))).toBe(true);
  await page.getByRole('button', { name: /mirar el pecho/ }).click();
  for (const n of ['Continuar', /^Llamar al 9-1-1 y poner/, 'Continuar', 'Omitir demostración', /^Pulgar en el émbolo/, 'Siguiente', /^Nada: viene/, 'Siguiente', /^Introduzco/, 'Dar la naloxona'])
    await page.getByRole('button', { name: n }).click();
  await expect(page.locator('.estado')).toContainText('Te quedan 1 de 2 dispositivos');
  await page.waitForTimeout(5500); // la animación de la dosis termina y la cámara vuelve
  expect(errores).toEqual([]);
});

test('modo sin guía: sin pistas ni explicación inmediata; llegan en el resumen de la fase', async ({ page }) => {
  await page.goto('arbol.html');
  await entrar(page, /^Fentanilo/, /Modo sin guía/);
  for (const n of ['Continuar', 'Continuar']) await page.getByRole('button', { name: n }).click();
  await page.getByRole('button', { name: /Mirar rápido/ }).click();
  await expect(page.locator('.pista')).toHaveCount(0);
  await page.getByRole('button', { name: /Echarle agua/ }).click();
  await expect(page.locator('.ultimo .feedback')).toHaveCount(0);
  for (const n of [/frotarle el centro/, /mirar el pecho/]) await page.getByRole('button', { name: n }).click();
  await expect(page.locator('#paso-titulo')).toHaveText('Resumen: Evaluación');
  await expect(page.locator('.paso .checklist li')).toHaveCount(4);
  await expect(page.locator('.paso .checklist .mark.no')).toHaveCount(1);
});

test('modo guiado: da una pista y explica cada decisión', async ({ page }) => {
  await page.goto('arbol.html');
  await entrar(page);
  for (const n of ['Continuar', 'Continuar']) await page.getByRole('button', { name: n }).click();
  await page.getByRole('button', { name: /Mirar rápido/ }).click();
  await expect(page.locator('.pista')).toContainText('Comprueba primero si responde');
  await expect(page.locator('.ultimo .feedback')).toContainText('Tu decisión');
});

test('reiniciar el caso vuelve al principio con el tiempo en cero', async ({ page }) => {
  await page.goto('arbol.html');
  await entrar(page);
  for (const n of ['Continuar', 'Continuar']) await page.getByRole('button', { name: n }).click();
  await page.getByRole('button', { name: /Mirar rápido/ }).click();
  await page.getByRole('button', { name: /Dejar que "duerma la nota"/ }).click();
  await expect(page.locator('.estado')).not.toContainText('Tiempo: 00:00');
  await page.getByRole('button', { name: 'Reiniciar el caso' }).click();
  await expect(page.locator('#paso-titulo')).toHaveText('Antes de empezar');
  await expect(page.locator('.estado')).toContainText('Tiempo: 00:00');
});

test('idioma: en producción no se ofrece el inglés mientras su traducción no esté aprobada', async ({ page }) => {
  await page.goto('arbol.html');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByLabel('Idioma')).toHaveCount(0);
});

test('movimiento reducido: sin transiciones ni iconos que laten', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('arbol.html');
  await entrar(page);
  const dur = await page.evaluate(() => getComputedStyle(document.querySelector('.btn') as Element).transitionDuration);
  expect(dur).toBe('0s');
  for (const n of ['Continuar', 'Continuar']) await page.getByRole('button', { name: n }).click();
  await page.getByRole('button', { name: /Mirar rápido/ }).click();
  await expect(page.locator('.marca').first()).toBeVisible();
  expect(await page.locator('.marca').first().evaluate((m) => getComputedStyle(m).animationName)).toBe('none');
});

test('se puede usar dentro de un iframe y avisa su altura a la página que lo contiene', async ({ page, baseURL }) => {
  const errores = vigilarConsola(page);
  // Página anfitriona de prueba (como la de otro sitio que incrusta el simulador), servida por la prueba.
  await page.route(`${baseURL}anfitrion-prueba.html`, (r) => r.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Anfitrión</title></head><body>
      <h1>Página de prueba</h1>
      <iframe src="arbol.html" title="Simulador de respuesta a sobredosis"
        sandbox="allow-scripts allow-same-origin allow-popups" style="width:900px;height:700px;border:0"></iframe>
      <script>window.alturas = []; addEventListener('message', (e) => { if (e.data && e.data.tipo === 'dspr-simulador-altura') alturas.push(e.data.altura); });</script>
      </body></html>`,
  }));
  await page.goto('anfitrion-prueba.html');
  const f = page.frameLocator('iframe');
  await entrar(f);
  await f.getByRole('button', { name: 'Continuar' }).click();
  await expect(f.locator('#paso-titulo')).toHaveText('Esto es lo que encuentras');
  await expect(f.locator('.escena3d canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { alturas: number[] }).alturas.length)).toBeGreaterThan(0);
  expect(errores).toEqual([]);
});
