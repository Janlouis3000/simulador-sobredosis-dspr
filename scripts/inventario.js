// Inventario de los modelos 3D (solo lee, no cambia nada): triángulos, vértices, peso, mallas que el navegador
// dibuja por separado (primitivas), texturas y si ya están comprimidos.
// Uso: npm run inventario [-- carpeta]   (por omisión, modelos/ y modelos/objetos/)
//
// Sirve para revisar un modelo nuevo o regenerado antes de ponerlo en el simulador: una persona tiene de 27 000 a
// 39 000 triángulos y un escenario de 2 000 a 39 000; algo mucho más pesado necesita una razón.
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const carpetas = process.argv[2] ? [process.argv[2]] : ['modelos', 'modelos/objetos'];

const TRIANGULOS = 4;
function triangulos(prim) {
  if (prim.getMode() !== TRIANGULOS) return 0;
  const idx = prim.getIndices();
  return (idx ? idx.getCount() : prim.getAttribute('POSITION').getCount()) / 3;
}

for (const dir of carpetas.filter((d) => existsSync(d))) {
  console.log(`\n${dir}/`);
  console.log('archivo'.padEnd(30), 'triáng.'.padStart(8), 'vért.'.padStart(8), 'KB'.padStart(6), 'mallas'.padStart(7), ' comprimido  texturas (px)  más pesadas');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.glb')).sort()) {
    const ruta = join(dir, f), doc = await io.read(ruta), root = doc.getRoot();
    let tri = 0, vert = 0, prims = 0;
    const porNodo = [];
    for (const node of root.listNodes()) {
      const mesh = node.getMesh();
      if (!mesh) continue;
      let t = 0;
      for (const p of mesh.listPrimitives()) { t += triangulos(p); vert += p.getAttribute('POSITION').getCount(); prims++; }
      tri += t; porNodo.push([node.getName() || '(sin nombre)', t]);
    }
    porNodo.sort((a, b) => b[1] - a[1]);
    const comprimido = root.listExtensionsUsed().some((e) => e.extensionName === 'EXT_meshopt_compression');
    const tex = root.listTextures().map((t) => t.getSize()?.[0] ?? '?').sort((a, b) => b - a);
    console.log(f.padEnd(30), String(tri).padStart(8), String(vert).padStart(8), String(Math.round(statSync(ruta).size / 1024)).padStart(6),
      String(prims).padStart(7), ` ${comprimido ? 'sí' : 'no'}`.padEnd(12), `[${tex.join(', ')}]`.padEnd(14),
      porNodo.slice(0, 3).map(([n, t]) => `${n} ${t}`).join(', '));
  }
}
