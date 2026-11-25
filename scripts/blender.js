// Corre un script de blender/ en Blender sin ventana. Lo usan `npm run escenarios` y `npm run miniaturas`, para no
// tener que saber dónde está Blender ni cómo se le pasan los argumentos. Los demás scripts (personajes con MPFB,
// mano) también se pueden correr así: node scripts/blender.js blender/generar_personajes_mpfb.py --solo h1
//
// Uso: node scripts/blender.js blender/<script>.py [argumentos del script…]
//
// Dónde busca Blender, en orden: la variable BLENDER (ruta al ejecutable), `blender` en el PATH y la versión más
// nueva en "C:\Program Files\Blender Foundation". Si no lo encuentra, lo dice y termina con código 1.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function buscarBlender() {
  if (process.env.BLENDER) return existsSync(process.env.BLENDER) ? process.env.BLENDER : null;
  if (spawnSync('blender', ['--version'], { stdio: 'ignore' }).status === 0) return 'blender';
  const base = join(process.env.ProgramFiles || 'C:\\Program Files', 'Blender Foundation');
  if (!existsSync(base)) return null;
  const versiones = readdirSync(base)
    .filter((d) => existsSync(join(base, d, 'blender.exe')))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  return versiones.length ? join(base, versiones[0], 'blender.exe') : null;
}

const [script, ...resto] = process.argv.slice(2);
if (!script) {
  console.error('Uso: node scripts/blender.js blender/<script>.py [argumentos…]');
  process.exit(1);
}
const blender = buscarBlender();
if (!blender) {
  console.error('No se encontró Blender. Instálalo o pon la ruta del ejecutable en la variable BLENDER.');
  process.exit(1);
}
console.log(`Blender: ${blender}\nScript: ${script} ${resto.join(' ')}`);
// --python-exit-code 1: si el script de Python falla, Blender termina con error (sin esto devuelve 0 igual).
const r = spawnSync(blender, ['--background', '--python-exit-code', '1', '--python', script, '--', ...resto], { stdio: 'inherit' });
process.exit(r.status ?? 1);
