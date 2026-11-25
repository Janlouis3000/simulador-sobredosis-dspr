// Comprime la geometría de modelos/persona_*.glb y modelos/escenario_*.glb con meshopt (EXT_meshopt_compression).
// Uso: npm run comprimir [-- carpeta]   (después de regenerar personas o escenarios en Blender; por omisión, modelos/)
//
// Cuantiza posiciones, normales, UV, pesos, colores de vértice y claves de forma, y las comprime. No toca las texturas
// (ya son WebP) ni los nombres de nodos, huesos, materiales y claves de forma, que scene.js necesita.
// No usa prune(): borraría el COLOR_0 (máscaras de cianosis) porque ningún material lo usa.
// Los archivos que ya están comprimidos se saltan, para no cuantizar dos veces: para volver a unir o comprimir un
// escenario hay que exportarlo de nuevo desde Blender (npm run escenarios).
//
// Escenarios: antes de comprimir se unen las mallas que comparten material (flatten + join), así el navegador las
// dibuja de una vez. Son estáticas y scene.js no busca sus nodos por nombre (solo lanza rayos contra el grupo para
// apoyar el charco). El baño pasa de 32 mallas a unas 14 y la sala de 52 a 19. Las personas no se unen: sus mallas
// llevan huesos, claves de forma y nombres que scene.js usa (Piel, Ojos, Cejas…).
import { readdirSync, statSync } from 'node:fs';
import { join as unirRuta } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, flatten, join, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

const dir = process.argv[2] || 'modelos'; // otra carpeta para probar sin tocar modelos/
const kb = (b) => Math.round(b / 1024);
let total0 = 0, total1 = 0;
for (const f of readdirSync(dir).filter((x) => /^(persona_|escenario_).+\.glb$/.test(x))) {
  const ruta = unirRuta(dir, f), antes = statSync(ruta).size;
  const doc = await io.read(ruta);
  if (doc.getRoot().listExtensionsUsed().some((e) => e.extensionName === 'EXT_meshopt_compression')) {
    console.log(f.padEnd(26), 'ya comprimido', kb(antes), 'KB');
    continue;
  }
  const mallas = () => doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().length, 0);
  const mallas0 = mallas();
  const escenario = f.startsWith('escenario_');
  await doc.transform(dedup(), ...(escenario ? [flatten(), join({ keepNamed: false })] : []),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(ruta, doc);
  const despues = statSync(ruta).size;
  total0 += antes; total1 += despues;
  console.log(f.padEnd(26), kb(antes), 'KB ->', kb(despues), 'KB', escenario ? `| mallas ${mallas0} -> ${mallas()}` : '');
}
if (total0) console.log('total', kb(total0), 'KB ->', kb(total1), 'KB');
