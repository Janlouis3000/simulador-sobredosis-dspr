// ================= Escena 3D (Three.js moderno, ES modules) =================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
// Geometría comprimida con scripts/comprimir.js. Sin useWorkers(): decodifica en el hilo principal, sin Worker ni blob:.
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ESCENARIOS, buildSet, contactShadow, vomitPuddle } from './ambiente.js';

// Desde r155 las luces son físicas: se multiplica por PI para conservar la iluminación de la v2 (r147).
const LI = Math.PI;

export const Scene3D = (() => {
  let R, scene, cam, controls, clock, person, props = {}, ready = false, setGroup = null;
  let contenedor = null, observador = null; // dónde está el lienzo ahora
  let nalox = null; // animación de la naloxona en curso
  let escenarioGLB = false; // el escenario a la vista es el horneado (true) o el procedural de respaldo (false)
  let camGoal = null; // { pos, target }
  let view = 'wide';
  const state = { pose: 'supine', anim: 'none', rr: 0, arrest: false, cyan: 0, cons: 0, vomit: false, phone: false, dosesUsed: 0, t: 0, pupil: 3.8, agit: 0, emocion: null };
  const D = Math.PI / 180;
  let envMap = null; // luz de entorno (RoomEnvironment), se crea una vez por renderer

  const SKIN = new THREE.Color('#9a6647'), SKIN_CY = new THREE.Color('#8b8798');
  const LIPS = new THREE.Color('#9b4d47'), LIPS_CY = new THREE.Color('#4a5689');

  // Pisos, paredes, muebles y luces de cada caso: ambiente.js.
  const SET = {
    // persona: primera letra de las variantes que sirven al texto del caso (content.js): 'h' hombre adulto,
    // 'm' mujer adulta, 'a' adolescente, 'v' adulto mayor. shirt y pants son para el maniquí.
    fentanilo: { shirt: '#3e6f91', pants: '#2e3a48', persona: 'h' },
    pastillas: { shirt: '#9c3d5a', pants: '#3b4b6b', persona: 'a' },
    xilazina: { shirt: '#5b6b3a', pants: '#3f3a35', persona: 'h' },
    tardio:   { shirt: '#4b4f63', pants: '#2b3140', persona: 'v' },
  };

  function mat(color, rough = 0.75, extra = {}) { return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: 0 }, extra)); }
  function mesh(geo, m, parent, pos, scale, rot) {
    const o = new THREE.Mesh(geo, m); o.castShadow = true; o.receiveShadow = true;
    if (pos) o.position.set(...pos); if (scale) o.scale.set(...scale); if (rot) o.rotation.set(...rot);
    parent.add(o); return o;
  }
  function joint(parent, pos) { const g = new THREE.Group(); g.position.set(...pos); parent.add(g); return g; }

  // ---------- Personaje articulado ----------
  function buildPerson(cfg) {
    const M = {
      skin: mat(SKIN.clone(), 0.62), lips: mat(LIPS.clone(), 0.45), shirt: mat(cfg.shirt, 0.88), pants: mat(cfg.pants, 0.9),
      shoe: mat('#1d1f24', 0.55), hair: mat('#1b1512', 0.8), lid: mat('#3a2418', 0.7), sole: mat('#e8e4dc', 0.7),
    };
    const sph = new THREE.SphereGeometry(1, 32, 22);
    const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 8, 20);
    const J = {};
    const root = new THREE.Group();
    // Pelvis
    mesh(sph, M.pants, root, [0, 0, 0], [0.165, 0.12, 0.115]);
    J.spine = joint(root, [0, 0.06, 0]);
    J.chest = joint(J.spine, [0, 0, 0]);
    mesh(cap(0.135, 0.25), M.shirt, J.chest, [0, 0.215, 0], [1.24, 1, 0.78]);
    mesh(sph, M.shirt, J.chest, [0, 0.05, 0.01], [0.16, 0.1, 0.11]);
    // Cuello y cabeza
    J.neck = joint(J.spine, [0, 0.47, 0]);
    mesh(new THREE.CylinderGeometry(0.047, 0.052, 0.11, 18), M.skin, J.neck, [0, 0.03, 0]);
    J.head = joint(J.neck, [0, 0.08, 0.005]);
    mesh(sph, M.skin, J.head, [0, 0.1, 0], [0.095, 0.118, 0.105]);
    mesh(sph, M.skin, J.head, [0, 0.045, 0.03], [0.072, 0.06, 0.075]); // mandíbula
    const hair = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.56);
    mesh(hair, M.hair, J.head, [0, 0.115, -0.012], [0.1, 0.112, 0.112], [-0.42, 0, 0]);
    mesh(sph, M.skin, J.head, [0.096, 0.1, -0.005], [0.014, 0.026, 0.018]);
    mesh(sph, M.skin, J.head, [-0.096, 0.1, -0.005], [0.014, 0.026, 0.018]);
    mesh(sph, M.skin, J.head, [0, 0.09, 0.104], [0.016, 0.022, 0.02]); // nariz
    const lid = cap(0.0085, 0.03);
    mesh(lid, M.lid, J.head, [0.036, 0.118, 0.094], null, [0, 0, Math.PI / 2]);
    mesh(lid, M.lid, J.head, [-0.036, 0.118, 0.094], null, [0, 0, Math.PI / 2]);
    mesh(cap(0.005, 0.03), M.hair, J.head, [0.037, 0.142, 0.094], null, [0, 0, Math.PI / 2 + 0.08]);
    mesh(cap(0.005, 0.03), M.hair, J.head, [-0.037, 0.142, 0.094], null, [0, 0, Math.PI / 2 - 0.08]);
    J.lips = mesh(sph, M.lips, J.head, [0, 0.05, 0.095], [0.03, 0.011, 0.014]);
    // Brazos
    for (const [s, x] of [['R', -1], ['L', 1]]) {
      const sh = J['sh' + s] = joint(J.spine, [0.2 * x, 0.395, 0]);
      mesh(sph, M.shirt, sh, [0, 0, 0], [0.062, 0.06, 0.06]);
      mesh(cap(0.047, 0.19), M.shirt, sh, [0, -0.125, 0]);
      const el = J['el' + s] = joint(sh, [0, -0.275, 0]);
      mesh(cap(0.039, 0.19), M.skin, el, [0, -0.12, 0]);
      mesh(sph, M.skin, el, [0, -0.27, 0.005], [0.04, 0.068, 0.023]);
      mesh(cap(0.011, 0.04), M.skin, el, [0.035 * x, -0.25, 0.02], null, [0.2, 0, -0.5 * x]);
      // Piernas
      const hp = J['hip' + s] = joint(root, [0.088 * x, -0.06, 0]);
      mesh(cap(0.068, 0.29), M.pants, hp, [0, -0.21, 0]);
      const kn = J['knee' + s] = joint(hp, [0, -0.43, 0]);
      mesh(cap(0.053, 0.3), M.pants, kn, [0, -0.2, 0]);
      const an = J['ankle' + s] = joint(kn, [0, -0.41, 0]);
      mesh(cap(0.046, 0.13), M.shoe, an, [0, -0.03, 0.055], [1, 1, 0.82], [Math.PI / 2, 0, 0]);
    }
    return { root, J, M, hands: rescuerHands(root), counter: [], faceUp: 0.1 };
  }

  // Manos del rescatista (RCP), en el espacio de la raíz: sobre el esternón, a 0.3 m de la pelvis.
  function rescuerHands(root) {
    const hands = new THREE.Group(), sph = new THREE.SphereGeometry(1, 32, 22), glove = mat('#e5bc44', 0.6);
    mesh(sph, glove, hands, [0, 0, 0], [0.05, 0.03, 0.085]);
    mesh(sph, glove, hands, [0, 0.03, 0], [0.048, 0.028, 0.08]);
    hands.visible = false;
    root.add(hands);
    return hands;
  }

  // ---------- Personajes GLB (modelos/persona_*.glb, generados con blender/generar_personajes_mpfb.py) ----------
  // Cada caso pide un género (SET[id].persona) y se escoge al azar una de sus variantes: así ningún caso queda
  // atado a un tono de piel. Mientras carga, o si no carga, se usa el maniquí de figuras de buildPerson.
  // En el build, vite-plugin-singlefile los embebe en dist/index.html como data URL.
  // Las mujeres adultas (persona_m*) no las pide ningún caso desde que el caso 2 es de una adolescente: se dejan
  // fuera del build para no sumarle 1.1 MB. Siguen en modelos/ por si un caso nuevo las necesita.
  const MODELOS = import.meta.glob(['../modelos/persona_*.glb', '!../modelos/persona_m*.glb'], { query: '?url', import: 'default', eager: true });
  const VARIANTES = Object.entries(MODELOS).map(([ruta, url]) => ({ id: ruta.match(/persona_(\w+)\.glb$/)[1], url }));
  const cargados = {}; // url -> promesa de gltf.scene preparada
  let elegida = null;   // { caseId, url }

  // ?persona=h2 en la dirección fija la variante (si es del tipo que pide el caso), p. ej. para capturas o talleres.
  function elegir(id) {
    const g = SET[id].persona, opciones = VARIANTES.filter((v) => v.id[0] === g);
    const fija = opciones.find((v) => v.id === new URLSearchParams(location.search).get('persona'));
    elegida = { caseId: id, url: (fija || opciones[Math.floor(Math.random() * opciones.length)]).url };
    return elegida.url;
  }
  // En el build el GLB viene como data URL y se decodifica aquí, sin fetch: algunos visores de archivos locales
  // interceptan fetch (DataCloneError) y reescriben las URL blob: (blob-request://), y fallan con lo embebido.
  // Por eso las texturas del GLB pasan a data URL antes de armar la escena y se cargan con TextureLoader
  // (elemento <img>), no con ImageBitmapLoader, que usa fetch.
  function aBase64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  const listos = {}; // url -> modelo ya cargado (para usarlo sin esperar)
  function cargar(url, preparar = prepararModelo) {
    if (!cargados[url]) {
      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      loader.register((parser) => {
        parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
        return {
          name: 'texturas_img',
          beforeRoot: () => Promise.all((parser.json.images || []).map(async (img) => {
            if (img.bufferView === undefined) return;
            const bytes = new Uint8Array(await parser.getDependency('bufferView', img.bufferView));
            img.uri = `data:${img.mimeType};base64,${aBase64(bytes)}`;
            delete img.bufferView;
          })),
        };
      });
      let g;
      if (url.startsWith('data:')) {
        const bin = atob(url.slice(url.indexOf(',') + 1)), buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        g = loader.parseAsync(buf.buffer, '');
      } else g = loader.loadAsync(url);
      cargados[url] = g.then((r) => (listos[url] = preparar(r.scene)));
    }
    return cargados[url];
  }

  // ---------- Escenarios horneados (modelos/escenario_*.glb, generados con blender/generar_escenarios.py) ----------
  // Los materiales horneados vienen negros con la luz de Cycles como emisión: el navegador solo agrega reflejos.
  // Si el escenario no ha cargado todavía, o no carga, se arma el escenario procedural de ambiente.js.
  const ESCENAS_GLB = import.meta.glob('../modelos/escenario_*.glb', { query: '?url', import: 'default', eager: true });
  const escenaURL = (id) => (Object.entries(ESCENAS_GLB).find(([ruta]) => ruta.endsWith(`escenario_${id}.glb`)) || [])[1];
  // Filtro anisotrópico: las texturas se ven nítidas en ángulo rasante (el piso de losas o de madera visto desde
  // la cámara, las alfombras, la ropa). Se limita a 8 muestras, que casi cualquier equipo soporta sin costo visible.
  const nitida = (t) => { if (t && R) { t.anisotropy = Math.min(8, R.capabilities.getMaxAnisotropy()); t.needsUpdate = true; } };
  function prepararEscenario(model) {
    model.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material;
      nitida(m.emissiveMap); nitida(m.map);
      if (m.emissiveMap) { m.color.set(0x000000); m.emissive.set(0xffffff); o.castShadow = false; o.receiveShadow = false; }
      else {
        o.castShadow = true; o.receiveShadow = true;
        if (m.metalness > 0.5) m.envMapIntensity = 4; // espejo y grifos: reflejan la luz de entorno
      }
    });
    return model;
  }
  function ponerEscenario(id) {
    if (setGroup) scene.remove(setGroup);
    setGroup = new THREE.Group(); scene.add(setGroup);
    const url = escenaURL(id), listo = url && listos[url];
    escenarioGLB = Boolean(listo);
    if (listo) {
      setGroup.add(listo.clone());
      // El piso horneado no recibe sombras en vivo: este plano invisible muestra solo la sombra de la persona.
      const sombra = new THREE.Mesh(new THREE.PlaneGeometry(4.9, 5), new THREE.ShadowMaterial({ opacity: 0.3 }));
      sombra.rotation.x = -Math.PI / 2; sombra.position.set(0.98, 0.002, 0.72); sombra.receiveShadow = true;
      setGroup.add(sombra);
      reapoyarCharco();
      return true;
    }
    buildSet(setGroup, id);
    reapoyarCharco();
    if (url) {
      const sceneNow = scene;
      cargar(url, prepararEscenario).then(() => { if (scene === sceneNow) ponerEscenario(id); },
        (e) => console.warn('No se pudo cargar el escenario GLB; se usa el procedural.', e));
    }
    return false;
  }

  // Ajustes que se hacen una vez por modelo (la geometría se comparte entre clones).
  function prepararModelo(model) {
    model.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      for (const m of [].concat(o.material)) nitida(m.map); // piel, pelo y ropa
      // Zonas de cianosis en COLOR_0 (ver generar_personajes_mpfb.py): r = labios, g = uñas, b = dedos.
      const c = o.geometry.attributes.color;
      if (c) {
        const z = new Float32Array(c.count * 3);
        for (let i = 0; i < c.count; i++) { z[i * 3] = c.getX(i); z[i * 3 + 1] = c.getY(i); z[i * 3 + 2] = c.getZ(i); }
        o.geometry.setAttribute('cyMask', new THREE.BufferAttribute(z, 3));
        o.geometry.deleteAttribute('color');
      }
    });
    return model;
  }

  // Cianosis de labios, uñas y dedos (protocolo DSPR: "cianosis en labios y uñas"). Labios y uñas se mezclan
  // hacia un morado grisáceo; los dedos se enfrían con un tinte azulado más leve. Solo el material de la piel la lleva.
  function cyanosisShader(m) {
    const u = { uCyan: { value: 0 }, uCy: { value: new THREE.Color('#5a6390') } };
    m.vertexColors = false;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = 'attribute vec3 cyMask;\nvarying vec3 vCy;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vCy = cyMask;');
      sh.fragmentShader = 'uniform float uCyan;\nuniform vec3 uCy;\nvarying vec3 vCy;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  vec3 morado = uCy * (0.6 + dot(diffuseColor.rgb, vec3(0.7)));
  diffuseColor.rgb = mix(diffuseColor.rgb, morado, clamp(uCyan * vCy.r, 0.0, 1.0) * 0.65);
  diffuseColor.rgb = mix(diffuseColor.rgb, mix(morado, vec3(dot(diffuseColor.rgb, vec3(0.33))), 0.3), clamp(uCyan * vCy.g, 0.0, 1.0) * 0.55);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.76, 0.83, 1.1), clamp(uCyan * vCy.b, 0.0, 1.0) * 0.6);`);
    };
    m.customProgramCacheKey = () => 'cianosis';
    return u.uCyan;
  }

  // Tinte multiplicado sobre la textura de piel cuando falta oxígeno (gris azulado).
  const TINT = new THREE.Color(1, 1, 1), TINT_CY = new THREE.Color(0.74, 0.8, 1.05);

  function buildPersonGLB(template) {
    const root = new THREE.Group(), model = cloneSkinned(template);
    root.add(model); root.updateMatrixWorld(true);
    const J = {}, M = {}, blink = [];
    model.traverse((o) => {
      if (o.isBone) J[o.name] = o;
      if (!o.isSkinnedMesh) return;
      const m = o.material = o.material.clone(), name = m.name;
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; // la caja de reposo no sigue las poses
      // Blender exporta todo como BLEND. El pelo va recortado por alfa; cejas y pestañas, que tienen bordes
      // suaves, con transparencia (son mallas pequeñas pegadas a la piel y no tienen problemas de orden).
      m.transparent = false; m.depthWrite = true;
      if (name === 'Pelo') { m.alphaTest = 0.35; m.side = THREE.DoubleSide; }
      if (name === 'Cejas' || name === 'Pestanas') { m.transparent = true; m.depthWrite = false; o.renderOrder = 1; }
      if (name === 'Piel') M.skin = m;
      if (name === 'Ojos') M.eyes = m;
      if (o.morphTargetDictionary && 'eyeBlinkLeft' in o.morphTargetDictionary) blink.push(o);
    });
    const lips = cyanosisShader(M.skin), pupil = M.eyes ? pupilShader(M.eyes) : null;
    // El hueso spine (pelvis) queda en el origen, como en el maniquí.
    model.position.y = -J.spine.getWorldPosition(new THREE.Vector3()).y;
    root.updateMatrixWorld(true);

    // POSES está escrito para articulaciones sin rotación de reposo y con brazos y piernas rectos hacia abajo.
    // MakeHuman deja los brazos abiertos (pose A) y los codos doblados, y cada hueso tiene su propia rotación.
    // Se corrige el reposo de brazos y piernas para que apunten hacia abajo (Cw) y se aplica la pose en el marco
    // del cuerpo: local = (reposo del padre)⁻¹ · pose · (reposo del hueso).
    const wq = (b) => b.getWorldQuaternion(new THREE.Quaternion()), wp = (b) => b.getWorldPosition(new THREE.Vector3());
    const restQ = {}, Cw = new Map(), down = new THREE.Vector3(0, -1, 0);
    for (const [a, b] of [['shL', 'elL'], ['shR', 'elR'], ['hipL', 'kneeL'], ['hipR', 'kneeR']]) {
      let c = new THREE.Quaternion();
      for (const k of [a, b]) {
        const child = J[k].children.find((x) => x.isBone);
        const dir = wp(child).sub(wp(J[k])).normalize().applyQuaternion(c);
        c = new THREE.Quaternion().setFromUnitVectors(dir, down).multiply(c);
        J[k].traverse((x) => { if (x.isBone) Cw.set(x, c); });
      }
    }
    const corrected = (b) => (Cw.get(b) || new THREE.Quaternion()).clone().multiply(wq(b));
    const parentInv = {};
    for (const [n, b] of Object.entries(J)) { restQ[n] = corrected(b); parentInv[n] = corrected(b.parent).invert(); }
    const toLocal = (k, q) => parentInv[k].clone().multiply(q).multiply(restQ[k]);

    // Respiración: chest se escala en el ancho y la profundidad del cuerpo. Se busca qué eje local del hueso
    // corresponde a cada eje del cuerpo, y sus hijos (cuello y clavículas) se escalan al revés para no inflarse.
    const axisOf = (q) => [0, 1, 2].map((i) => {
      const v = new THREE.Vector3().setComponent(i, 1).applyQuaternion(q);
      const a = [Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)]; return a.indexOf(Math.max(...a));
    });
    const chestAxes = axisOf(wq(J.chest));
    const counter = J.chest.children.filter((x) => x.isBone).map((b) => ({ b, axes: axisOf(wq(b)) }));

    // Cámara de cara: altura de los ojos sobre el hueso head, y el frente y arriba del modelo en ejes del hueso.
    const eyes = model.getObjectByName('Ojos');
    const faceUp = eyes ? new THREE.Box3().setFromObject(eyes).getCenter(new THREE.Vector3()).y - wp(J.head).y : 0.07;
    const headInv = wq(J.head).invert();
    const headFwd = new THREE.Vector3(0, 0, 1).applyQuaternion(headInv), headUp = new THREE.Vector3(0, 1, 0).applyQuaternion(headInv);

    const p = { glb: true, root, J, M, hands: rescuerHands(root), toLocal, blink, lips, pupil, faceUp, headFwd, headUp,
      eyeOpen: EYE_REST, eyeRight: EYE_REST, pupilCheck: -1,
      chestAxes, counter, tint: TINT, tintCy: TINT_CY };
    p.ground = groundPoses(p);
    return p;
  }

  // Ojos: 0 cerrados, 1 abiertos (claves de forma eyeBlinkLeft/Right de MPFB en piel, cejas y pestañas).
  // Sin responder quedan entreabiertos (EYE_REST), como suele verse en una sobredosis.
  const EYE_REST = 0.12;
  function setLids(p, izq, der = izq) {
    for (const o of p.blink) {
      const d = o.morphTargetDictionary;
      o.morphTargetInfluences[d.eyeBlinkLeft] = 1 - izq;
      o.morphTargetInfluences[d.eyeBlinkRight] = 1 - der;
    }
  }

  // Pupila: el shader agranda o achica el disco negro de la textura del ojo de MakeHuman. La textura trae los dos
  // ojos; centros (UV, origen arriba a la izquierda) y radios medidos sobre brown_eye.png: pupila 0.037, iris 0.114.
  // El iris real mide unos 11.7 mm, así que el radio en la textura es mm / 11.7 × 0.114.
  const OJO = { c: [[0.708, 0.298], [0.290, 0.708]], rp: 0.037, ri: 0.114, irisMM: 11.7 };
  const pupilRadius = (mm) => Math.min(OJO.ri * 0.8, Math.max(0.006, mm / OJO.irisMM * OJO.ri));
  function pupilShader(m) {
    const u = { value: OJO.rp }, f = (x) => x.toFixed(4);
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uPupil = u;
      sh.fragmentShader = `uniform float uPupil;
vec2 pupila(vec2 uv, vec2 c) {
  vec2 d = uv - c; float r = length(d);
  if (r >= ${f(OJO.ri)} || r < 1e-5) return uv;
  float r0 = r < uPupil ? r * ${f(OJO.rp)} / uPupil : ${f(OJO.rp)} + (r - uPupil) * ${f(OJO.ri - OJO.rp)} / (${f(OJO.ri)} - uPupil);
  return c + d / r * r0;
}
` + sh.fragmentShader.replace('#include <map_fragment>', `#ifdef USE_MAP
  diffuseColor *= texture2D(map, pupila(pupila(vMapUv, vec2(${OJO.c[0].map(f)})), vec2(${OJO.c[1].map(f)})));
#endif`);
    };
    m.customProgramCacheKey = () => 'pupila';
    return u;
  }

  // Vómito: aparece en el piso junto a la boca (de lado, frente a la cara; boca arriba, al lado de la cabeza).
  function placeVomit() {
    const hq = person.J.head.getWorldQuaternion(new THREE.Quaternion()), h = headWorld();
    const fwd = (person.headFwd || new THREE.Vector3(0, 0, 1)).clone().applyQuaternion(hq);
    const flat = new THREE.Vector3(fwd.x, 0, fwd.z);
    let p;
    // Boca arriba se pone del lado al que se gira en la posición de rescate (+x), para que no lo tape el brazo.
    if (flat.length() < 0.35) { p = h.clone().add(new THREE.Vector3(0.27, 0, -0.03)); flat.set(1, 0, 0); }
    else { flat.normalize(); p = h.clone().addScaledVector(flat, 0.2); }
    props.vomit.position.set(p.x, alturaApoyo(p.x, p.z), p.z);
    props.vomit.rotation.y = Math.atan2(flat.x, flat.z);
    props.vomit.scale.setScalar(0.2);
  }

  // Altura de la superficie donde se apoya el charco en (x, z): el piso o, si hay, la alfombra que está encima.
  // Se lanza un rayo hacia abajo contra el escenario (horneado o procedural) y se toma el punto más alto que esté
  // cerca del piso: así una mesa o una cama al lado no cuentan. Se suma una separación para que no parpadee.
  const SEPARACION_CHARCO = 0.002, ALTURA_MAX_APOYO = 0.06;
  const rayo = new THREE.Raycaster(), ABAJO = new THREE.Vector3(0, -1, 0);
  function alturaApoyo(x, z) {
    let y = 0;
    if (setGroup) {
      setGroup.updateMatrixWorld(true);
      rayo.set(new THREE.Vector3(x, ALTURA_MAX_APOYO + 0.5, z), ABAJO);
      for (const hit of rayo.intersectObject(setGroup, true)) {
        if (!hit.object.isMesh || hit.object.material?.isShadowMaterial || !hit.object.visible) continue;
        if (hit.point.y <= ALTURA_MAX_APOYO && hit.point.y > y) y = hit.point.y;
      }
    }
    return y + SEPARACION_CHARCO;
  }
  // Al cambiar de escenario (el procedural se cambia por el horneado cuando termina de cargar), el charco que ya
  // está a la vista se vuelve a apoyar sobre la superficie nueva, en el mismo lugar junto a la boca.
  function reapoyarCharco() {
    if (props.vomit?.visible) props.vomit.position.y = alturaApoyo(props.vomit.position.x, props.vomit.position.z);
  }
  // Solo lectura, para pruebas y diagnóstico: dónde está el charco y sobre qué escenario.
  function charco() {
    const v = props.vomit;
    return v ? { visible: v.visible, x: v.position.x, y: v.position.y, z: v.position.z, apoyo: alturaApoyo(v.position.x, v.position.z), escenarioGLB } : null;
  }

  // Sombra de contacto: elipse oscura bajo el cuerpo, de la cabeza a los tobillos.
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
  function updateShadow() {
    const J = person.J;
    J.head.getWorldPosition(_a); J.ankleL.getWorldPosition(_b); J.ankleR.getWorldPosition(_c); J.spine.getWorldPosition(_d);
    _b.add(_c).multiplyScalar(0.5);
    const ax = _a.x - _b.x, az = _a.z - _b.z, len = Math.hypot(ax, az);
    const s = props.shadow;
    s.position.set((_a.x + _b.x + 2 * _d.x) / 4, 0.003, (_a.z + _b.z + 2 * _d.z) / 4);
    s.rotation.set(-Math.PI / 2, 0, Math.atan2(-ax, -az));
    s.scale.set(0.62, Math.max(0.7, len + 0.45), 1);
  }

  // Escala de respiración en ejes del cuerpo (x ancho, y largo, z profundidad) → ejes locales del hueso.
  const _bodyScale = [1, 1, 1];
  function breathe(p, sx, sz) {
    _bodyScale[0] = sx; _bodyScale[2] = sz;
    if (!p.chestAxes) { p.J.chest.scale.set(sx, 1, sz); return; }
    const s = p.chestAxes.map((i) => _bodyScale[i]);
    p.J.chest.scale.set(...s);
    for (const c of p.counter) c.b.scale.set(...c.axes.map((i) => 1 / _bodyScale[i]));
  }

  // Altura de la raíz en cada pose para que el punto más bajo del cuerpo toque el piso.
  function groundPoses(p) {
    const out = {}, v = new THREE.Vector3(), meshes = [];
    p.root.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
    for (const name of Object.keys(POSES)) {
      const T = poseTargets(name, p);
      applyPoseInstant(p, T); p.root.updateMatrixWorld(true);
      let min = Infinity;
      for (const m of meshes) {
        m.skeleton.update();
        for (let i = 0, n = m.geometry.attributes.position.count; i < n; i++) min = Math.min(min, m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld).y);
      }
      out[name] = T._rootP.y - min + 0.004;
    }
    return out;
  }

  function setPerson(p) {
    if (person) scene.remove(person.root);
    conducta.base = null; // los giros guardados eran de la persona anterior
    person = p; scene.add(p.root);
    const name = targets ? targets._name : 'supine';
    targets = poseTargets(name); targets._name = name;
    applyPoseInstant();
    if (p.blink) setLids(p, p.eyeOpen);
  }

  // Poses: rotaciones (rad) por articulación + raíz
  const POSES = {
    supine: {
      root: { p: [0, 0.135, 0], r: [-90, 0, 0] },
      neck: [10, 0, 0], head: [12, 0, 0], shR: [0, 0, -14], shL: [0, 0, 14], elR: [-10, 0, 0], elL: [-10, 0, 0],
      hipR: [0, 0, -5], hipL: [0, 0, 5], kneeR: [4, 0, 0], kneeL: [4, 0, 0], ankleR: [20, 0, 0], ankleL: [20, 0, 0],
    },
    open: {
      root: { p: [0, 0.135, 0], r: [-90, 0, 0] },
      neck: [-14, 0, 0], head: [-22, 0, 0], shR: [0, 0, -14], shL: [0, 0, 14], elR: [-10, 0, 0], elL: [-10, 0, 0],
      hipR: [0, 0, -5], hipL: [0, 0, 5], kneeR: [4, 0, 0], kneeL: [4, 0, 0], ankleR: [20, 0, 0], ankleL: [20, 0, 0],
    },
    side: {
      root: { p: [0, 0.205, 0], r: 'side' },
      neck: [-8, 0, -14], head: [-14, 0, -8],
      shR: [-62, 0, 34], elR: [-112, 0, 0],   // mano de arriba bajo la mejilla
      shL: [-80, 0, -30], elL: [-20, 0, 0],   // brazo de abajo hacia el frente, apoyado en el piso
      hipR: [-78, 0, 24], kneeR: [96, 0, 0], ankleR: [10, 0, 0],
      hipL: [-12, 0, 0], kneeL: [22, 0, 0], ankleL: [10, 0, 0],
    },
    sitting: {
      root: { p: [0, 0.13, -0.28], r: [-12, 0, 0] },
      neck: [18, 0, 0], head: [16, 0, 0], shR: [-38, 0, -8], shL: [-38, 0, 8], elR: [-62, 0, 0], elL: [-62, 0, 0],
      // rodillas arriba y pies en el piso (en la v2 las piernas atravesaban el piso)
      hipR: [-130, 0, -10], hipL: [-130, 0, 10], kneeR: [112, 0, 0], kneeL: [112, 0, 0], ankleR: [0, 0, 0], ankleL: [0, 0, 0],
    },
  };
  const qSide = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -108 * D))
    .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-90 * D, 0, 0)));
  function poseTargets(name, p = person) {
    const P = POSES[name], out = {};
    for (const k of Object.keys(P)) {
      if (k === 'root') continue;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(P[k][0] * D, P[k][1] * D, P[k][2] * D));
      out[k] = p.toLocal ? p.toLocal(k, q) : q;
    }
    out._rootQ = P.root.r === 'side' ? qSide.clone() : new THREE.Quaternion().setFromEuler(new THREE.Euler(P.root.r[0] * D, P.root.r[1] * D, P.root.r[2] * D));
    out._rootP = new THREE.Vector3(...P.root.p);
    if (p.ground) out._rootP.y = p.ground[name];
    return out;
  }
  let targets = null;

  // ---------- Conducta al despertar ----------
  // Equivalente web del Random Behavior System de Unity: cada emoción (state.emocion, la pone la conversación de
  // ui.js) es un contenedor de bloques de conducta con su porcentaje. Cada pocos segundos se escoge un bloque al
  // azar según esos porcentajes. La agitación (state.agit, 0 a 1) acorta la espera, agranda los gestos y suma un
  // temblor fino, que es parte de la abstinencia.
  // Los giros se escriben como en POSES (grados, sin rotación de reposo) y se convierten con toLocal, así que
  // sirven igual para el GLB y para el maniquí. Se suman a la pose después del slerp y se quitan antes del
  // siguiente, para no acumularse.
  const EMOCIONES = {
    enojo:     { negar: 30, mirar: 30, mecer: 20, quieta: 20 },
    miedo:     { mirar: 35, manoCara: 25, mecer: 20, cabizbaja: 20 },
    confusion: { mirar: 50, quieta: 25, cabizbaja: 25 },
    asco:      { apartar: 35, manoBoca: 30, cabizbaja: 20, quieta: 15 },
    gratitud:  { asentir: 40, quieta: 35, cabizbaja: 25 },
    verguenza: { cabizbaja: 45, manoCara: 30, mirar: 10, quieta: 15 },
    _:         { quieta: 50, mirar: 30, cabizbaja: 20 },
  };
  // Mano derecha a la mejilla (vergüenza, miedo) o a la boca (asco): giro extra de hombro (z lleva el brazo hacia
  // el centro del cuerpo) y codo sobre la pose sentada. Medidos a ojo con persona_a1; sirven para todo el rig.
  const MANO = { cara: { shR: [0, 0, 38], elR: [-85, 0, 0] }, boca: { shR: [-15, 0, 42], elR: [-88, 0, 0] } };
  const conducta = { id: 'quieta', hasta: 0, yaw: 0, pitch: 0, mecer: 0, mano: 0, gy: 0, gp: 0, base: null };
  function nuevaConducta(a) {
    const bloques = Object.entries(EMOCIONES[state.emocion] || EMOCIONES._);
    let r = Math.random() * 100, i = 0;
    while (r > bloques[i][1] && i < bloques.length - 1) r -= bloques[i++][1];
    conducta.id = bloques[i][0];
    conducta.hasta = state.t + 1.8 + Math.random() * (2.8 - 1.4 * a);
    const lado = Math.random() < 0.5 ? -1 : 1, amp = 0.6 + 0.6 * a;
    conducta.gy = conducta.id === 'mirar' ? lado * (20 + 20 * Math.random()) * amp
      : conducta.id === 'apartar' ? lado * 38 : 0;
    conducta.gp = conducta.id === 'cabizbaja' ? 22 : conducta.id === 'mirar' ? -4 : conducta.id === 'apartar' ? -10
      : conducta.id === 'manoCara' ? 14 : conducta.id === 'manoBoca' ? 8 : 0;
  }
  const JC = ['chest', 'neck', 'head', 'shR', 'elR', 'elL'];
  function quitarConducta() {
    if (!conducta.base) return;
    for (const k of JC) if (person.J[k] && conducta.base[k]) person.J[k].quaternion.copy(conducta.base[k]);
    conducta.base = null;
  }
  function ponerConducta(dt) {
    if (targets._name !== 'sitting' || state.cons < 3) { conducta.yaw = conducta.pitch = conducta.mecer = conducta.mano = 0; return; }
    const a = state.agit;
    if (state.t > conducta.hasta) nuevaConducta(a);
    const s = 1 - Math.exp(-dt * 4);
    conducta.yaw += (conducta.gy - conducta.yaw) * s;
    conducta.pitch += (conducta.gp - conducta.pitch) * s;
    conducta.mecer += ((conducta.id === 'mecer' ? 1 : 0) - conducta.mecer) * s;
    const quiereMano = conducta.id === 'manoCara' || conducta.id === 'manoBoca';
    conducta.mano += ((quiereMano ? 1 : 0) - conducta.mano) * (1 - Math.exp(-dt * 3));
    if (quiereMano) conducta.cualMano = conducta.id === 'manoBoca' ? 'boca' : 'cara';
    const negar = conducta.id === 'negar' ? (10 + 10 * a) * Math.sin(state.t * 7) : 0;
    const asentir = conducta.id === 'asentir' ? 9 * Math.max(0, Math.sin(state.t * 4.5)) : 0;
    // Al limpiarse la boca, la mano va y viene un poco.
    const limpiar = conducta.cualMano === 'boca' ? 6 * Math.sin(state.t * 5) * conducta.mano : 0;
    const temblor = (0.4 + 1.6 * a) * Math.sin(state.t * 61) * Math.sin(state.t * 3.7);
    const M = MANO[conducta.cualMano || 'cara'], m = conducta.mano;
    const off = {
      chest: [6 * conducta.mecer * Math.sin(state.t * 2.6), 0, 0],
      neck: [conducta.pitch * 0.4 + asentir * 0.4, (conducta.yaw + negar) * 0.35, 0],
      head: [conducta.pitch * 0.6 + asentir * 0.6 + temblor * 0.5, (conducta.yaw + negar) * 0.65 + temblor, 0],
      shR: [M.shR[0] * m, limpiar, M.shR[2] * m],
      elR: [M.elR[0] * m + temblor * 1.5, 0, 0], elL: [-temblor * 1.5, 0, 0],
    };
    conducta.base = {};
    const P = POSES.sitting;
    for (const k of JC) {
      const j = person.J[k]; if (!j) continue;
      conducta.base[k] = j.quaternion.clone();
      const e = P[k] || [0, 0, 0]; // chest no está en POSES: su pose es la de reposo
      const qP = new THREE.Quaternion().setFromEuler(new THREE.Euler(e[0] * D, e[1] * D, e[2] * D));
      const qO = qP.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(off[k][0] * D, off[k][1] * D, off[k][2] * D)));
      const lP = person.toLocal ? person.toLocal(k, qP) : qP, lO = person.toLocal ? person.toLocal(k, qO) : qO;
      // Rotación que lleva la pose a la pose con el giro, aplicada sobre lo que el slerp dejó este cuadro.
      j.quaternion.premultiply(lO.multiply(lP.invert()));
    }
  }

  // ---------- Utilería ----------
  // Dispositivo de naloxona nasal con la forma del spray de 4 mg: boquilla, cuerpo blanco con dos hombros para los
  // dedos y dos patas, y el émbolo de color en el medio. Es genérico: sin marca ni logotipo. Queda con la punta de
  // la boquilla en el origen apuntando a +z, el ancho en x y el grosor en y. Devuelve el émbolo (para animarlo).
  const ROSA = '#c2185b';
  // El kit del piso va un poco más grande que en la realidad para que se distinga en la vista general; el
  // dispositivo en la mano va a tamaño real.
  const ESCALA_KIT = 1.45;
  let geoNaloxona = null;
  function cuerpoNaloxona(g) {
    const blanco = mat('#f6f6f4', 0.4), rosa = mat(ROSA, 0.45);
    if (!geoNaloxona) {
      const s = new THREE.Shape();
      s.moveTo(-0.006, -0.028);
      s.quadraticCurveTo(-0.022, -0.028, -0.022, -0.041);
      s.lineTo(-0.022, -0.062); s.quadraticCurveTo(-0.022, -0.065, -0.019, -0.065);
      s.lineTo(-0.014, -0.065); s.quadraticCurveTo(-0.011, -0.065, -0.011, -0.062);
      s.lineTo(-0.011, -0.055); s.quadraticCurveTo(-0.011, -0.05, -0.006, -0.05);
      s.lineTo(0.006, -0.05); s.quadraticCurveTo(0.011, -0.05, 0.011, -0.055);
      s.lineTo(0.011, -0.062); s.quadraticCurveTo(0.011, -0.065, 0.014, -0.065);
      s.lineTo(0.019, -0.065); s.quadraticCurveTo(0.022, -0.065, 0.022, -0.062);
      s.lineTo(0.022, -0.041); s.quadraticCurveTo(0.022, -0.028, 0.006, -0.028);
      s.closePath();
      geoNaloxona = new THREE.ExtrudeGeometry(s, { depth: 0.011, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0015, bevelSegments: 3, curveSegments: 10 });
      geoNaloxona.translate(0, 0, -0.0055); // centra el grosor
      geoNaloxona.rotateX(Math.PI / 2);     // la silueta queda en el plano xz y el grosor en y
    }
    mesh(geoNaloxona, blanco, g);
    mesh(new THREE.CapsuleGeometry(0.0052, 0.026, 6, 14), blanco, g, [0, 0, -0.0182], null, [Math.PI / 2, 0, 0]); // boquilla
    mesh(new THREE.BoxGeometry(0.034, 0.0156, 0.006), rosa, g, [0, 0, -0.039]);                                    // franja de la etiqueta
    const embolo = mesh(new THREE.CylinderGeometry(0.0058, 0.0058, 0.026, 16), rosa, g, [0, 0, -0.062], null, [Math.PI / 2, 0, 0]);
    embolo.userData.z0 = -0.062;
    return embolo;
  }
  // Un dispositivo en su empaque individual (blíster), en el piso.
  function narcan(x, z) {
    const g = new THREE.Group(), dentro = new THREE.Group();
    dentro.position.set(0, 0.0115, 0.0375); g.add(dentro);
    cuerpoNaloxona(dentro);
    mesh(new THREE.BoxGeometry(0.066, 0.004, 0.098), mat('#dfe4ea', 0.35, { metalness: 0.45 }), g, [0, 0.002, 0]);
    const burbuja = mesh(new THREE.BoxGeometry(0.054, 0.019, 0.086), mat('#ffffff', 0.08, { transparent: true, opacity: 0.22, depthWrite: false }), g, [0, 0.0135, 0]);
    burbuja.castShadow = false;
    g.position.set(x, 0, z); g.rotation.y = 0.5; g.scale.setScalar(ESCALA_KIT);
    scene.add(g); return g;
  }
  // Caja del kit, con dos dosis. La etiqueta se dibuja en un lienzo: nombre genérico, sin marca.
  function cajaNaloxona(x, z) {
    const c = document.createElement('canvas'); c.width = 280; c.height = 360;
    const k = c.getContext('2d');
    k.fillStyle = '#fbfbf9'; k.fillRect(0, 0, 280, 360);
    k.fillStyle = ROSA; k.fillRect(236, 0, 44, 360);
    k.textAlign = 'left'; k.textBaseline = 'alphabetic';
    k.font = '800 40px Arial, sans-serif'; k.fillText('NALOXONA', 14, 150);
    k.fillStyle = '#17203f'; k.font = '700 26px Arial, sans-serif'; k.fillText('SPRAY NASAL', 14, 186); k.fillText('4 mg', 14, 218);
    k.font = '600 20px Arial, sans-serif'; k.fillText('2 dosis', 14, 300);
    k.fillStyle = ROSA; k.beginPath(); k.arc(34, 70, 20, 0, Math.PI * 2); k.fill();
    k.fillStyle = '#fbfbf9'; k.fillRect(30, 56, 8, 28); k.fillRect(20, 66, 28, 8);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const blanco = mat('#fbfbf9', 0.6), rosa = mat(ROSA, 0.6), frente = mat('#ffffff', 0.6, { map: tex });
    const caja = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.04), [rosa, blanco, blanco, blanco, frente, blanco]);
    caja.castShadow = true; caja.receiveShadow = true;
    caja.scale.setScalar(ESCALA_KIT); caja.position.set(x, 0.045 * ESCALA_KIT, z); caja.rotation.y = 0.54; // el frente mira a la vista general
    scene.add(caja); return caja;
  }
  function phone() {
    const g = new THREE.Group();
    mesh(new THREE.BoxGeometry(0.075, 0.01, 0.15), mat('#15171c', 0.4), g, [0, 0.005, 0]);
    mesh(new THREE.BoxGeometry(0.066, 0.002, 0.135), mat('#1b7a4a', 0.3, { emissive: new THREE.Color('#2fd27f'), emissiveIntensity: 0.9 }), g, [0, 0.011, 0]);
    g.position.set(0.47, 0, -0.82); g.rotation.y = -0.4; g.visible = false; // del lado de la cámara, junto al hombro
    scene.add(g); return g;
  }

  // ---------- Naloxona a la vista ----------
  // Dispositivo de spray nasal en la mano enguantada del rescatista. La boquilla apunta a +z para poder usar
  // lookAt hacia la nariz.
  // La mano es modelos/mano_naloxona.glb (blender/generar_mano.py): una mano real con guante, posada en el agarre
  // del protocolo, en el mismo sistema que el dispositivo y con el antebrazo hacia +y. Mientras carga, o si no
  // carga, se usa una mano simple hecha con cápsulas (el antebrazo hacia -y).
  const MANO_GLB = Object.values(import.meta.glob('../modelos/mano_naloxona.glb', { query: '?url', import: 'default', eager: true }))[0];
  const prepararMano = (model) => {
    model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
    return model;
  };
  function dispositivoEnMano() {
    const raiz = new THREE.Group(), g = new THREE.Group();
    raiz.add(g);
    const guante = mat('#6fb4de', 0.55);
    raiz.userData.embolo = cuerpoNaloxona(raiz);
    raiz.userData.simple = g;
    if (MANO_GLB) {
      const sceneNow = scene;
      cargar(MANO_GLB, prepararMano).then((m) => {
        if (scene !== sceneNow) return;
        raiz.add(m.clone()); g.visible = false; raiz.userData.real = true;
      }, (e) => console.warn('No se pudo cargar la mano; se usa la mano simple.', e));
    }
    // Mano simple: pulgar en el émbolo, índice y dedo del corazón a cada lado de la boquilla (protocolo DSPR, paso 5).
    const sph = new THREE.SphereGeometry(1, 20, 14);
    const dedo = (largo, r, pos, rot) => mesh(new THREE.CapsuleGeometry(r, largo, 6, 12), guante, g, pos, null, rot);
    dedo(0.036, 0.0075, [0.016, -0.012, -0.022], [0.25, 0, 0.1]);    // índice, sobre un hombro del cuerpo
    dedo(0.036, 0.0075, [-0.016, -0.012, -0.022], [0.25, 0, -0.1]);  // dedo del corazón, sobre el otro
    dedo(0.03, 0.0085, [0.003, -0.012, -0.086], [-0.5, 0, 0.15]);    // pulgar, debajo del émbolo
    dedo(0.03, 0.0075, [0.012, -0.044, -0.04], [0, 0, Math.PI / 2]); // anular y meñique recogidos
    dedo(0.026, 0.007, [0.012, -0.054, -0.054], [0, 0, Math.PI / 2]);
    mesh(sph, guante, g, [0, -0.045, -0.068], [0.03, 0.02, 0.04]);   // palma
    dedo(0.09, 0.021, [0, -0.084, -0.126], [0.95, 0, 0]);            // muñeca y antebrazo
    raiz.userData.rocio = mesh(sph, new THREE.MeshBasicMaterial({ color: '#dff2fb', transparent: true, opacity: 0, depthWrite: false }), raiz, [0, 0, 0.012], [0.01, 0.01, 0.01]);
    raiz.userData.rocio.castShadow = false;
    raiz.visible = false;
    scene.add(raiz); return raiz;
  }  // Punto de una fosa nasal en el mundo (lado: -1 derecha de la persona, 1 izquierda) y hacia dónde mira la cara.
  function nariz(lado) {
    const hq = new THREE.Quaternion(); person.J.head.getWorldQuaternion(hq);
    const fwd = (person.headFwd || new THREE.Vector3(0, 0, 1)).clone().applyQuaternion(hq);
    const up = (person.headUp || new THREE.Vector3(0, 1, 0)).clone().applyQuaternion(hq);
    const lat = new THREE.Vector3().crossVectors(up, fwd);
    const p = headWorld().addScaledVector(up, person.faceUp - 0.022).addScaledVector(fwd, 0.1).addScaledVector(lat, 0.012 * lado);
    return { p, fwd, up };
  }
  // "Le das la naloxona": la mano lleva el dispositivo a una fosa nasal, presiona el émbolo y sale el rocío.
  // La segunda dosis va en la otra fosa nasal. Dura unos 4.5 s (la cámara tarda cerca de 1 s en llegar a la cara);
  // con movimiento reducido no se llama.
  // fijo (0 a 1) deja la animación quieta en ese punto, para capturas y pruebas.
  function darNaloxona(fijo) {
    if (!ready || !person) return;
    nalox = { t0: state.t, dur: 4.5, lado: state.dosesUsed >= 2 ? 1 : -1, vista: nalox ? nalox.vista : view, fijo };
    // Cámara de perfil y algo desde arriba, mirando la nariz: es donde mejor se ve entrar la boquilla. La vista
    // 'face' no sirve aquí: en la posición de rescate la mano de la persona queda entre la cámara y la cara.
    const n = nariz(nalox.lado), lat = new THREE.Vector3().crossVectors(n.up, n.fwd), Y = new THREE.Vector3(0, 1, 0);
    const haciaVista = new THREE.Vector3(1.5, 1.5, 1.15).sub(n.p).normalize();
    if (lat.dot(haciaVista) < 0) lat.negate(); // el perfil que da hacia la vista general
    // De lado (posición de rescate) la cara queda hacia el piso y detrás del brazo: de cerca no se ve nada, así
    // que se acerca un poco la vista general, desde más arriba, y se ve la mano llegar a la cara.
    const bocaArriba = n.fwd.y > 0.5;
    const d = bocaArriba ? lat.multiplyScalar(0.75).addScaledVector(n.fwd, 0.3).addScaledVector(Y, 0.3).addScaledVector(n.up, -0.15).normalize()
      : haciaVista.multiplyScalar(0.5).add(Y).normalize();
    const pos = n.p.clone().addScaledVector(d, bocaArriba ? 0.5 : 1.25);
    if (pos.y < 0.15) pos.y = 0.15;
    camGoal = { pos, target: n.p.clone() };
  }
  function animarNaloxona() {
    const m = props.mano, u = nalox.fijo ?? (state.t - nalox.t0) / nalox.dur;
    if (u >= 1) { m.visible = false; const v = nalox.vista; nalox = null; setView(v); return; }
    const n = nariz(nalox.lado);
    // Llega desde abajo y al frente de la cara, en línea con la fosa nasal.
    // De lado (posición de rescate) llega más desde arriba, para no chocar con la mano que la persona tiene
    // frente a la cara.
    const dir = n.fwd.clone().multiplyScalar(0.62).addScaledVector(n.up, -0.78)
      .addScaledVector(new THREE.Vector3(0, 1, 0), 0.7 * (1 - Math.max(0, n.fwd.y))).normalize();
    // Los dos dedos quedan a los lados de la nariz y el antebrazo sale hacia afuera de la cara, por encima del
    // pecho (de lado, más hacia arriba): la mano llega desde arriba y no atraviesa el cuerpo. En la mano real el
    // antebrazo va hacia +y; en la simple, hacia -y.
    const fuera = n.fwd.clone().multiplyScalar(0.8).addScaledVector(n.up, -0.5)
      .addScaledVector(new THREE.Vector3(0, 1, 0), 0.7 * (1 - Math.max(0, n.fwd.y)));
    m.up.copy(fuera).multiplyScalar(m.userData.real ? 1 : -1);
    // 0.2-0.5 llega a la nariz · 0.58 presiona el émbolo · 0.6-0.78 rocío · se queda hasta 0.88 · se retira.
    const a = Math.max(0, Math.min(1, (u - 0.2) / 0.3)), suave = a * a * (3 - 2 * a);
    const sale = u > 0.88 ? (u - 0.88) / 0.12 : 0;
    m.position.copy(n.p).addScaledVector(dir, 0.22 * (1 - suave) + 0.004 + 0.12 * sale);
    m.lookAt(n.p);
    m.visible = true;
    const presion = Math.max(0, Math.min(1, (u - 0.55) / 0.05));
    m.userData.embolo.position.z = m.userData.embolo.userData.z0 + 0.008 * presion;
    const r = Math.max(0, Math.min(1, (u - 0.6) / 0.18));
    m.userData.rocio.material.opacity = r > 0 && r < 1 ? 0.55 * (1 - r) : 0;
    m.userData.rocio.scale.setScalar(0.008 + 0.03 * r);
  }

  // ---------- Puntos de anclaje para los iconos de la interfaz ----------
  // Devuelve dónde caen en la pantalla (px dentro del lienzo) partes del cuerpo y objetos. El simulador por pasos
  // pone ahí botones redondos con las opciones del paso; la lista de opciones en HTML sigue siendo la equivalente
  // accesible. frente = hacia dónde mira el pecho; arriba = hacia la cabeza.
  function anclas() {
    if (!ready || !person) return null;
    const w = R.domElement.clientWidth, h = R.domElement.clientHeight;
    const rq = new THREE.Quaternion(); person.root.getWorldQuaternion(rq);
    const frente = new THREE.Vector3(0, 0, 1).applyQuaternion(rq), arriba = new THREE.Vector3(0, 1, 0).applyQuaternion(rq);
    const de = (j) => { const v = new THREE.Vector3(); (person.J[j] || person.root).getWorldPosition(v); return v; };
    const n = nariz(0);
    const P = {
      cabeza: headWorld().addScaledVector(n.up, person.faceUp + 0.1).addScaledVector(n.fwd, 0.03),
      ojos: headWorld().addScaledVector(n.up, person.faceUp + 0.035).addScaledVector(n.fwd, 0.09),
      boca: headWorld().addScaledVector(n.up, person.faceUp - 0.055).addScaledVector(n.fwd, 0.09),
      pecho: de('chest').addScaledVector(frente, 0.11).addScaledVector(arriba, 0.14),
      cadera: de('spine').addScaledVector(frente, 0.1),
      mano: de('elR').addScaledVector(frente, 0.05),
      piernas: de('kneeL').addScaledVector(frente, 0.08),
      telefono: props.phone.position.clone().setY(0.06),
      kit: props.n1.position.clone().lerp(props.n2.position, 0.5).setY(0.06),
    };
    const out = {};
    for (const [k, v] of Object.entries(P)) {
      const p = v.project(cam);
      out[k] = { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h, visible: p.z < 1 && Math.abs(p.x) < 0.98 && Math.abs(p.y) < 0.98 };
    }
    return out;
  }

  function init(container, id) {
    if (!R) {
      R = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
      R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFShadowMap;
      R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 0.95;
      cam = new THREE.PerspectiveCamera(36, 16 / 10, 0.05, 30);
      controls = new OrbitControls(cam, R.domElement);
      controls.enableDamping = true; controls.dampingFactor = 0.08; controls.minDistance = 0.3; controls.maxDistance = 4.5;
      controls.maxPolarAngle = 1.48; controls.enablePan = false;
      controls.addEventListener('start', () => { camGoal = null; });
      clock = new THREE.Timer(); clock.connect(document);
      R.setAnimationLoop(loop);
      // Luz de entorno: un cuarto genérico que da reflejos y luz rebotada a pisos, losas, piel y líquidos.
      const pmrem = new THREE.PMREMGenerator(R);
      envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    }
    // El lienzo se muda si el contenedor cambió (el simulador por pasos lo crea de nuevo en cada partida).
    if (contenedor !== container) {
      container.prepend(R.domElement);
      if (observador) observador.disconnect();
      observador = new ResizeObserver(() => resize(container));
      observador.observe(container);
      contenedor = container;
    }
    nalox = null;
    scene = new THREE.Scene();
    const E = ESCENARIOS[id];
    scene.environment = envMap; scene.environmentIntensity = E.env;
    const hemi = new THREE.HemisphereLight(E.hemi[0], E.hemi[1], E.hemi[2] * LI); scene.add(hemi);
    const key = new THREE.DirectionalLight(E.key[0], E.key[1] * LI); key.position.set(1.6, 3.4, 1.4); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -2; key.shadow.camera.right = 2; key.shadow.camera.top = 2; key.shadow.camera.bottom = -2;
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 5; scene.add(key);
    const fill = new THREE.DirectionalLight(0x8acff3, 0.3 * LI); fill.position.set(-2.5, 1.8, 2); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.3 * LI); rim.position.set(0, 2, -3); scene.add(rim);
    scene.background = new THREE.Color(E.bg);
    setGroup = null; ponerEscenario(id);
    props.n1 = narcan(0.32, -0.55); props.n2 = narcan(0.4, -0.42); props.caja = cajaNaloxona(0.53, -0.56);
    props.phone = phone();
    props.mano = dispositivoEnMano();
    props.vomit = vomitPuddle(); scene.add(props.vomit);
    props.shadow = contactShadow(); scene.add(props.shadow);
    state.pose = 'supine';
    person = null; targets = null;
    setPerson(buildPerson(SET[id]));
    // El personaje GLB reemplaza al maniquí apenas carga (con el archivo embebido tarda una fracción de segundo).
    const url = elegida && elegida.caseId === id ? elegida.url : elegir(id);
    elegida = null; // la próxima corrida escoge otra variante
    const sceneNow = scene;
    cargar(url).then((m) => { if (scene === sceneNow) setPerson(buildPersonGLB(m)); },
      (e) => console.warn('No se pudo cargar el personaje GLB; se usa el maniquí.', e));
    setView('wide', true);
    resize(container);
    ready = true;
  }

  function applyPoseInstant(p = person, T = targets) {
    for (const k of Object.keys(T)) if (p.J[k]) p.J[k].quaternion.copy(T[k]);
    p.root.quaternion.copy(T._rootQ); p.root.position.copy(T._rootP);
  }
  function resize(container) {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
  }

  function headWorld() { const v = new THREE.Vector3(); person.J.head.getWorldPosition(v); return v; }
  function setView(v, instant) {
    view = v;
    let pos, target;
    if (v === 'face') {
      const h = headWorld(), hq = new THREE.Quaternion(); person.J.head.getWorldQuaternion(hq);
      const fwd = (person.headFwd || new THREE.Vector3(0, 0, 1)).clone().applyQuaternion(hq);
      const up = (person.headUp || new THREE.Vector3(0, 1, 0)).clone().applyQuaternion(hq);
      const side = new THREE.Vector3().crossVectors(up, fwd).multiplyScalar(0.12);
      target = h.clone().addScaledVector(up, person.faceUp).addScaledVector(fwd, 0.04); // centro de la cara
      pos = target.clone().addScaledVector(fwd, 0.5).addScaledVector(up, -0.16).add(side);
      if (pos.y < 0.12) pos.y = 0.12;
    } else { target = new THREE.Vector3(0, 0.1, -0.05); pos = new THREE.Vector3(1.5, 1.5, 1.15); }
    if (instant) { cam.position.copy(pos); controls.target.copy(target); controls.update(); camGoal = null; }
    else camGoal = { pos, target };
  }

  function loop(timestamp) {
    if (!ready) return;
    clock.update(timestamp);
    const dt = Math.min(0.05, clock.getDelta());
    state.t += dt;
    // Pose
    const k = 1 - Math.exp(-dt * 5);
    quitarConducta();
    for (const j of Object.keys(targets)) if (person.J[j]) person.J[j].quaternion.slerp(targets[j], k);
    person.root.quaternion.slerp(targets._rootQ, k);
    person.root.position.lerp(targets._rootP, k);
    ponerConducta(dt);
    // Respiración
    let amp = 0, sq = 0;
    if (state.anim === 'cpr') {
      const ph = (state.t * 110 / 60) % 1;
      sq = ph < 0.5 ? Math.sin(ph * 2 * Math.PI) : 0;
      person.hands.visible = true;
      person.hands.position.set(0, 0.3, 0.13 + 0.035 * (1 - sq));
    } else person.hands.visible = false;
    if (state.anim === 'breaths') {
      const ph = (state.t % 5) / 5; amp = ph < 0.35 ? Math.sin(ph / 0.35 * Math.PI) * 1.1 : 0;
    } else if (state.arrest) {
      const ph = state.t % 7; amp = ph < 0.5 ? Math.sin(ph / 0.5 * Math.PI) * 0.45 : 0; // jadeo agónico
    } else if (state.rr >= 0.8) {
      const ph = (state.t * state.rr / 60) % 1;
      amp = Math.pow(Math.sin(ph * Math.PI), 2) * Math.min(1, 0.35 + state.rr / 14);
    }
    breathe(person, 1 + 0.025 * amp, 1 + 0.07 * amp - 0.12 * sq);
    // Ojos: cerrados si no responde; entreabiertos si está somnolienta; abiertos si despertó
    // Al revisar las pupilas, el rescatista le abre el párpado derecho unos segundos.
    if (person.blink) {
      const want = state.arrest ? EYE_REST * 0.6 : ([EYE_REST, EYE_REST, 0.5, 1][state.cons] ?? EYE_REST);
      person.eyeOpen += (want - person.eyeOpen) * (1 - Math.exp(-dt * 3));
      const der = state.t < person.pupilCheck ? 1 : person.eyeOpen;
      person.eyeRight += (der - person.eyeRight) * (1 - Math.exp(-dt * 6));
      setLids(person, person.eyeOpen, person.eyeRight);
    }
    if (person.pupil) person.pupil.value += (pupilRadius(state.pupil) - person.pupil.value) * (1 - Math.exp(-dt * 4));
    // Color (cianosis)
    if (person.glb) {
      person.M.skin.color.copy(person.tint).lerp(person.tintCy, state.cyan * 0.55);
      person.lips.value = state.cyan;
    } else {
      person.M.skin.color.copy(SKIN).lerp(SKIN_CY, state.cyan * 0.55);
      person.M.lips.color.copy(LIPS).lerp(LIPS_CY, state.cyan);
    }
    // Utilería
    props.n1.visible = state.dosesUsed < 1; props.n2.visible = state.dosesUsed < 2;
    props.phone.visible = state.phone;
    // Mientras se ve la mano dando la naloxona, el charco espera: primero la administración, después el vómito.
    const vomito = state.vomit && !nalox;
    if (vomito && !props.vomit.visible) placeVomit();
    props.vomit.visible = vomito;
    if (props.vomit.visible && props.vomit.scale.x < 1) props.vomit.scale.setScalar(Math.min(1, props.vomit.scale.x + dt * 0.7));
    updateShadow();
    if (nalox) animarNaloxona();
    // Cámara
    if (camGoal) {
      cam.position.lerp(camGoal.pos, 1 - Math.exp(-dt * 4));
      controls.target.lerp(camGoal.target, 1 - Math.exp(-dt * 4));
      if (cam.position.distanceTo(camGoal.pos) < 0.01) camGoal = null;
    }
    controls.update();
    R.render(scene, cam);
  }

  function update(o) {
    if (!ready) return;
    Object.assign(state, o);
    const want = o.pose || state.pose;
    if (targets && want !== targets._name) { targets = poseTargets(want); targets._name = want; if (view === 'face') setTimeout(() => setView('face'), 450); }
  }

  // Al escoger un caso: elige la variante y empieza a cargarla antes de "Comenzar".
  function prepare(id) {
    cargar(elegir(id)).catch(() => {});
    const url = escenaURL(id);
    if (url) cargar(url, prepararEscenario).catch(() => {});
  }

  // "Le abres un párpado con el pulgar": abre el ojo derecho unos segundos para ver la pupila.
  function checkPupils() { if (ready && person) person.pupilCheck = state.t + 5; }

  return { init, update, setView, prepare, checkPupils, anclas, darNaloxona, charco, get view() { return view; } };
})();
