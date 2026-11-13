// Utilidades de las pruebas de interfaz.
import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import type { FrameLocator, Page } from '@playwright/test';

/** Del menú a la simulación: Jugar → Escoger escenario → tarjeta del caso → (modo) → Comenzar. */
export async function entrar(raiz: Page | FrameLocator, caso: RegExp = /^Fentanilo/, modo?: RegExp): Promise<void> {
  await raiz.getByRole('button', { name: 'Jugar' }).click();
  await raiz.getByRole('button', { name: 'Escoger escenario' }).click();
  await raiz.getByRole('button', { name: caso }).click();
  if (modo) await raiz.getByLabel(modo).check();
  await raiz.getByRole('button', { name: 'Comenzar' }).click();
}

/** Errores de la consola (incluidas violaciones de la política de seguridad). */
export function vigilarConsola(page: Page): string[] {
  const errores: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  page.on('pageerror', (e) => errores.push(e.message));
  return errores;
}

/** axe-core con las reglas de WCAG 2.0, 2.1 y 2.2, niveles A y AA. */
export async function revisarAccesibilidad(page: Page, donde: string): Promise<void> {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const resumen = r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
  expect(resumen, `axe en ${donde}`).toEqual([]);
}

/** Solo con teclado: Tab hasta el botón (o control) cuyo texto coincida y Enter (o Espacio en radios). */
export async function teclado(page: Page, texto: RegExp, max = 60): Promise<void> {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const enfocado = await page.evaluate(() => {
      const e = document.activeElement as HTMLElement | null;
      if (!e) return { texto: '', tipo: '' };
      const label = e.closest('label');
      return { texto: (label?.innerText ?? e.innerText ?? '').trim(), tipo: (e as HTMLInputElement).type ?? e.tagName };
    });
    if (texto.test(enfocado.texto)) {
      await page.keyboard.press(enfocado.tipo === 'radio' || enfocado.tipo === 'checkbox' ? 'Space' : 'Enter');
      return;
    }
  }
  throw new Error(`No se llegó con Tab a: ${texto}`);
}

/** El foco quedó en el título del paso (lo anuncia el lector de pantalla). */
export async function focoEnTitulo(page: Page): Promise<string> {
  return page.evaluate(() => {
    const e = document.activeElement;
    return e && /^H[1-4]$/.test(e.tagName) ? (e.textContent ?? '') : `(foco en ${e?.tagName})`;
  });
}

/** Juega con clics hasta el informe, escogiendo las respuestas correctas. */
export async function jugarHastaInforme(page: Page): Promise<void> {
  const PREF = [/otra dosis/, /^Empezar la RCP/, /RCP de inmediato/, /inclinarle la cabeza/, /respiraciones de rescate/, /Mantenerle la barbilla/,
    /^Ponerla de lado, con/, /limpiarle la boca/, /^Quedarte a su lado/, /hasta que llegue la ambulancia/, /^Llamar al 9-1-1 y poner/, /^Llamar al 9-1-1 en altavoz$/,
    /frotarle el centro/, /mirar el pecho/, /Mirar rápido/, /Seguir ayudándole/, /naloxona rápido/];
  const BUENAS = /^Pulgar en el émbolo|^Nada: viene|^Introduzco|Hablarle bajo|Eso que sientes|Te entiendo|Don Ramón, mire|Eso es por el medicamento|No es molestia|Estás a salvo|Es normal sentirse/;
  for (let i = 0; i < 80; i++) {
    if (await page.locator('.informe').count()) return;
    const botones = page.locator('main button');
    const textos = await botones.allInnerTexts();
    const pick = (re: RegExp) => textos.findIndex((t) => re.test(t.trim()));
    let k = pick(/^Omitir demostración$/);
    if (k < 0) k = pick(/^(Siguiente|Dar la naloxona|Usar un dispositivo nuevo|Seguir|Continuar)$/);
    if (k < 0) k = pick(BUENAS);
    if (k < 0) for (const re of PREF) { k = pick(re); if (k >= 0) break; }
    if (k < 0) throw new Error(`Sin opción conocida: ${textos.join(' / ')}`);
    await botones.nth(k).click();
  }
  throw new Error('No llegó al informe');
}
