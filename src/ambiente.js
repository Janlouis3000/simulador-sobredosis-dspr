// ================= Ambiente: superficies, escenarios, sombra de contacto y vómito =================
// Todo se genera en el navegador, sin archivos de imagen: cada superficie tiene mapa de color, de relieve
// (normal) y de rugosidad, para que los pisos y paredes reflejen la luz como material real.
import * as THREE from 'three';

// ---------- Ruido ----------
function hash(x, y, s) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// Ruido de valor periódico (período p celdas) para que las texturas se repitan sin costura.
function vnoise(x, y, p, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = (i) => ((i % p) + p) % p;
  const a = hash(w(xi), w(yi), s), b = hash(w(xi + 1), w(yi), s), c = hash(w(xi), w(yi + 1), s), d = hash(w(xi + 1), w(yi + 1), s);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
// Ruido fractal con u, v en [0, 1) y f celdas en la primera octava.
function fbm(u, v, f, s, oct = 3) {
  let a = 0, amp = 0.5, n = 0;
  for (let o = 0; o < oct; o++) { a += amp * vnoise(u * f, v * f, f, s + o * 17); n += amp; amp *= 0.5; f *= 2; }
  return a / n;
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
function hsl(h, s, l) {
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

// ---------- Superficies ----------
// fn(u, v, o) llena o.c (color sRGB 0-255), o.h (altura 0-1) y o.r (rugosidad 0-1). Se guardan en caché.
const cache = {};
function surface(key, size, fn, bump = 2.5) {
  if (cache[key]) return cache[key];
  const n = size * size, col = new Uint8Array(n * 4), rough = new Uint8Array(n * 4), nor = new Uint8Array(n * 4), h = new Float32Array(n);
  const o = { c: [0, 0, 0], h: 0, r: 1 };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    fn(x / size, y / size, o);
    const i = y * size + x;
    col[i * 4] = o.c[0]; col[i * 4 + 1] = o.c[1]; col[i * 4 + 2] = o.c[2]; col[i * 4 + 3] = 255;
    rough[i * 4 + 1] = o.r * 255; rough[i * 4 + 3] = 255; // three lee la rugosidad del canal verde
    h[i] = o.h;
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const at = (xx, yy) => h[((yy + size) % size) * size + ((xx + size) % size)];
    let nx = (at(x - 1, y) - at(x + 1, y)) * bump, ny = (at(x, y - 1) - at(x, y + 1)) * bump;
    const l = Math.hypot(nx, ny, 1), i = (y * size + x) * 4;
    nor[i] = (nx / l * 0.5 + 0.5) * 255; nor[i + 1] = (ny / l * 0.5 + 0.5) * 255; nor[i + 2] = (1 / l * 0.5 + 0.5) * 255; nor[i + 3] = 255;
  }
  const tex = (data, srgb) => {
    const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 8;
    t.needsUpdate = true; return t;
  };
  return (cache[key] = { map: tex(col, true), normalMap: tex(nor, false), roughnessMap: tex(rough, false) });
}

// Losas con junta: n × n por textura.
function tiles(base, junta, n = 4) {
  const b = rgb(base), j = rgb(junta);
  return surface('tiles' + base + n, 512, (u, v, o) => {
    const gu = u * n, gv = v * n, iu = Math.floor(gu), iv = Math.floor(gv), fu = gu - iu, fv = gv - iv;
    const e = Math.min(fu, 1 - fu, fv, 1 - fv), t = smooth(0.012, 0.03, e);
    const k = 1 + (hash(iu, iv, 7) - 0.5) * 0.06 + (fbm(u, v, 8, 3) - 0.5) * 0.05, kj = 0.85 + 0.3 * fbm(u, v, 32, 5);
    for (let c = 0; c < 3; c++) o.c[c] = b[c] * k * t + j[c] * kj * (1 - t);
    o.h = smooth(0.012, 0.05, e) * 0.9 + fbm(u, v, 64, 9) * 0.05;
    o.r = 0.14 + 0.08 * fbm(u, v, 16, 11) + (1 - t) * 0.75;
  }, 3);
}
// Madera: n tablas a lo ancho, juntas escalonadas y veta que sigue la tabla.
function wood(tono, luz, n = 8) {
  return surface('wood' + tono + luz + n, 512, (u, v, o) => {
    const pu = u * n, ip = Math.floor(pu), fu = pu - ip;
    const lv = v * 2 + hash(ip, 0, 11), ib = Math.floor(lv), fv = lv - ib, id = hash(ip, ib, 13);
    const veta = 0.5 + 0.5 * Math.sin(2 * Math.PI * (u * n * 12 + fbm(u, v, 6, 21 + ip) * 3 + id * 5));
    const nudo = fbm(u, v, 16, 31);
    const junta = (fu < 0.025 || fu > 0.975 || fv < 0.006) ? 1 : 0;
    const c = hsl(tono + id * 6, 0.42, luz + (id - 0.5) * 0.1 - veta * 0.05 - (nudo > 0.72 ? 0.06 : 0));
    o.c[0] = c[0] * (1 - junta * 0.6); o.c[1] = c[1] * (1 - junta * 0.6); o.c[2] = c[2] * (1 - junta * 0.6);
    o.h = junta ? 0 : 0.9 - veta * 0.12;
    o.r = 0.42 + veta * 0.12 + junta * 0.4;
  }, 2.5);
}
// Concreto con manchas, puntos y una junta de dilatación.
function concrete() {
  return surface('concrete', 512, (u, v, o) => {
    let g = 0.56 + (fbm(u, v, 4, 31) - 0.5) * 0.2 + (fbm(u, v, 32, 41) - 0.5) * 0.08;
    if (fbm(u, v, 2, 51) > 0.6) g -= 0.07;
    if (hash(Math.floor(u * 512), Math.floor(v * 512), 3) > 0.985) g -= 0.12;
    const junta = Math.abs(v - 0.5) < 0.004;
    if (junta) g -= 0.18;
    o.c[0] = g * 255; o.c[1] = g * 252; o.c[2] = g * 246;
    o.h = junta ? 0 : 0.6 + fbm(u, v, 64, 61) * 0.4;
    o.r = 0.86 + 0.1 * fbm(u, v, 16, 71);
  }, 2);
}
// Ladrillos: 4 por fila, 8 filas, hiladas alternadas y mortero hundido.
function bricks() {
  const m = rgb('#c4bdb2');
  return surface('bricks', 512, (u, v, o) => {
    const fila = Math.floor(v * 8), x = u * 4 + (fila % 2) * 0.5, col = Math.floor(x), fx = x - col, fy = v * 8 - fila;
    const e = Math.min(fx * 2, (1 - fx) * 2, fy, 1 - fy), t = smooth(0.04, 0.08, e), id = hash(((col % 4) + 4) % 4, fila, 17);
    const c = hsl(10 + id * 12, 0.45 + id * 0.1, 0.34 + id * 0.1 + (fbm(u, v, 32, 19) - 0.5) * 0.08);
    const km = 0.85 + 0.25 * fbm(u, v, 64, 23);
    for (let k = 0; k < 3; k++) o.c[k] = c[k] * t + m[k] * km * (1 - t);
    o.h = smooth(0.04, 0.12, e) * 0.85 + fbm(u, v, 32, 29) * 0.15;
    o.r = 0.9;
  }, 3);
}
// Pared pintada: textura leve de repello.
function plaster(color) {
  const b = rgb(color);
  return surface('plaster' + color, 256, (u, v, o) => {
    const k = 1 + (fbm(u, v, 8, 71) - 0.5) * 0.05 + (fbm(u, v, 64, 81) - 0.5) * 0.04;
    for (let c = 0; c < 3; c++) o.c[c] = b[c] * k;
    o.h = fbm(u, v, 64, 81) * 0.6;
    o.r = 0.82 + 0.1 * fbm(u, v, 16, 91);
  }, 1.2);
}
// Alfombra de rayas con borde, con textura de fibra.
function rug(colores) {
  const cs = colores.map(rgb);
  return surface('rug' + colores.join(), 256, (u, v, o) => {
    const borde = u < 0.06 || u > 0.94 || v < 0.08 || v > 0.92;
    const i = borde ? 0 : 1 + Math.floor(v * 7) % (cs.length - 1);
    const k = 0.85 + 0.3 * vnoise(u * 256, v * 256, 256, 5);
    for (let c = 0; c < 3; c++) o.c[c] = cs[i][c] * k;
    o.h = k - 0.85; o.r = 1;
  }, 1.5);
}

function surf(s, repeat, extra = {}) {
  const m = new THREE.MeshStandardMaterial(Object.assign({ roughness: 1, metalness: 0 }, extra));
  for (const k of ['map', 'normalMap', 'roughnessMap']) { m[k] = s[k].clone(); m[k].repeat.set(...repeat); m[k].needsUpdate = true; }
  return m;
}
function mat(color, rough = 0.75, extra = {}) { return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: 0 }, extra)); }
function mesh(geo, m, parent, pos, scale, rot, sombra = true) {
  const o = new THREE.Mesh(geo, m); o.castShadow = sombra; o.receiveShadow = true;
  if (pos) o.position.set(...pos); if (scale) o.scale.set(...scale); if (rot) o.rotation.set(...rot);
  parent.add(o); return o;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 24, abierto = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, abierto);

// Sombra suave (degradado) para rincones y para el contacto del cuerpo con el piso.
let _grad = null;
function gradTex() {
  if (_grad) return _grad;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(0,0,0,1)'); r.addColorStop(0.55, 'rgba(0,0,0,0.55)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return (_grad = new THREE.CanvasTexture(c));
}
let _edge = null;
function edgeTex() {
  if (_edge) return _edge;
  const c = document.createElement('canvas'); c.width = 4; c.height = 64;
  const g = c.getContext('2d'), l = g.createLinearGradient(0, 0, 0, 64);
  l.addColorStop(0, 'rgba(0,0,0,1)'); l.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = l; g.fillRect(0, 0, 4, 64);
  return (_edge = new THREE.CanvasTexture(c));
}
// Negro con la transparencia del degradado (canal alfa del canvas).
const shade = (tex, opacity) => new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false, color: 0x000000 });

// Oscurece el encuentro de pared y piso (oclusión aproximada).
function rincon(scene, largo, pos, rotY, enPared) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(largo, 0.45), shade(edgeTex(), 0.32));
  if (enPared) { m.position.set(pos[0], 0.225, pos[2]); m.rotation.set(0, rotY, Math.PI); }
  else { m.position.set(pos[0], 0.002, pos[2]); m.rotation.set(-Math.PI / 2, 0, rotY); }
  m.renderOrder = 1; scene.add(m);
}

// ---------- Escenarios ----------
// Cuarto de 7 × 7 m con pared de fondo en z = -1.75 y pared izquierda en x = -1.45; la persona queda en el centro.
export const ESCENARIOS = {
  fentanilo: { bg: '#b9c6cf', env: 0.25, hemi: [0xf4f7ff, 0x6b6257, 0.34], key: [0xfff4e6, 1.05] },
  pastillas: { bg: '#d2c6b4', env: 0.22, hemi: [0xfff2df, 0x6b5a47, 0.34], key: [0xffe9cc, 1.0] },
  xilazina: { bg: '#8e979e', env: 0.2, hemi: [0xdfe8f2, 0x55504a, 0.32], key: [0xeef3ff, 0.95] },
  tardio: { bg: '#c3cad6', env: 0.22, hemi: [0xf2f4ff, 0x655a50, 0.34], key: [0xfff0dd, 1.0] },
};

export function buildSet(scene, id) {
  scene.background = new THREE.Color(ESCENARIOS[id].bg);
  const wall = (m) => {
    const back = mesh(new THREE.PlaneGeometry(7, 2.6), m, scene, [0, 1.3, -1.75], null, null, false);
    const left = mesh(new THREE.PlaneGeometry(7, 2.6), m, scene, [-1.45, 1.3, 0], null, [0, Math.PI / 2, 0], false);
    return [back, left];
  };
  const floor = (m) => mesh(new THREE.PlaneGeometry(7, 7), m, scene, [0, 0, 0], null, [-Math.PI / 2, 0, 0], false);
  const zocalo = (m) => {
    mesh(box(7, 0.09, 0.02), m, scene, [0, 0.045, -1.74], null, null, false);
    mesh(box(0.02, 0.09, 7), m, scene, [-1.44, 0.045, 0], null, null, false);
  };
  const rincones = () => {
    rincon(scene, 7, [0, 0, -1.52], 0, false); rincon(scene, 7, [-1.22, 0, 0], Math.PI / 2, false);
    rincon(scene, 7, [0, 0, -1.74], 0, true); rincon(scene, 7, [-1.44, 0, 0], Math.PI / 2, true);
  };
  const white = mat('#f7f8f8', 0.12), hidden = new THREE.MeshBasicMaterial({ visible: false }), metal = mat('#c9ced3', 0.18, { metalness: 1 });

  if (id === 'fentanilo') {
    floor(surf(tiles('#d3d9dc', '#8f989e', 4), [6, 6]));
    wall(surf(plaster('#bfd3de'), [5, 2]));
    // Enchapado de losa hasta 1.2 m
    const enchape = surf(tiles('#e8eef1', '#aeb8be', 4), [5.8, 1]);
    mesh(new THREE.PlaneGeometry(7, 1.2), enchape, scene, [0, 0.6, -1.745], null, null, false);
    mesh(new THREE.PlaneGeometry(7, 1.2), enchape, scene, [-1.445, 0.6, 0], null, [0, Math.PI / 2, 0], false);
    mesh(box(7, 0.03, 0.03), white, scene, [0, 1.2, -1.735], null, null, false);
    mesh(box(0.03, 0.03, 7), white, scene, [-1.435, 1.2, 0], null, null, false);
    // Bañera: caja sin tapa por fuera y por dentro (BackSide), con borde
    const tub = new THREE.Group(); tub.position.set(-1.06, 0, -0.6); scene.add(tub);
    mesh(box(0.72, 0.55, 1.6), [white, white, hidden, white, white, white], tub, [0, 0.275, 0]);
    mesh(box(0.6, 0.42, 1.48), [white, white, hidden, white, white, white].map((m) => m === hidden ? m : mat('#eef3f6', 0.1, { side: THREE.BackSide })), tub, [0, 0.34, 0], null, null, false);
    for (const [w, d, x, z] of [[0.72, 0.06, 0, 0.77], [0.72, 0.06, 0, -0.77], [0.06, 1.6, 0.33, 0], [0.06, 1.6, -0.33, 0]]) mesh(box(w, 0.03, d), white, tub, [x, 0.565, z]);
    mesh(cyl(0.012, 0.012, 0.16, 12), metal, tub, [-0.22, 0.64, -0.74]);
    mesh(cyl(0.01, 0.01, 0.12, 12), metal, tub, [-0.22, 0.71, -0.68], null, [Math.PI / 2, 0, 0]);
    // Sin toalla sobre el borde (se leía como una tabla de madera), igual que el escenario horneado.
    // Inodoro
    const wc = new THREE.Group(); wc.position.set(0.9, 0, -1.42); scene.add(wc);
    mesh(cyl(0.13, 0.16, 0.36), white, wc, [0, 0.18, 0.05]);
    mesh(cyl(0.2, 0.15, 0.06), white, wc, [0, 0.39, 0.07], [1, 1, 1.25]);
    mesh(new THREE.TorusGeometry(0.16, 0.025, 10, 28), white, wc, [0, 0.43, 0.07], [1, 1.25, 1], [Math.PI / 2, 0, 0]);
    mesh(box(0.42, 0.38, 0.17), white, wc, [0, 0.62, -0.2]);
    mesh(box(0.44, 0.03, 0.19), white, wc, [0, 0.82, -0.2]);
    // Lavamanos con gabinete y espejo
    const gabinete = mat('#6f8796', 0.55);
    mesh(box(0.7, 0.8, 0.45), gabinete, scene, [0.05, 0.4, -1.52]);
    for (const x of [-0.12, 0.22]) mesh(box(0.3, 0.66, 0.012), mat('#7d94a3', 0.5), scene, [x, 0.42, -1.292]);
    for (const x of [0.02, 0.08]) mesh(box(0.012, 0.1, 0.02), metal, scene, [x, 0.55, -1.28]);
    mesh(box(0.74, 0.04, 0.49), white, scene, [0.05, 0.82, -1.5]);
    mesh(cyl(0.012, 0.012, 0.14, 12), metal, scene, [0.05, 0.9, -1.66]);
    // Espejo a la misma altura que en el escenario horneado (empieza por encima del remate del enchape).
    mesh(box(0.62, 0.8, 0.02), mat('#d9e2e6', 0.04, { metalness: 1, envMapIntensity: 4 }), scene, [0.05, 1.72, -1.735], null, null, false);
    mesh(box(0.66, 0.84, 0.015), mat('#8a6a4a', 0.6), scene, [0.05, 1.72, -1.742], null, null, false);
    // Alfombra de baño
    mesh(box(0.55, 0.012, 0.8), surf(rug(['#2f6f7f', '#3f8796', '#e9eef0']), [1, 1]), scene, [-0.48, 0.006, -0.55], null, null, false);
    zocalo(white); rincones();
  } else if (id === 'pastillas') {
    floor(surf(wood(30, 0.5, 8), [4, 4]));
    wall(surf(plaster('#efe6d6'), [5, 2]));
    // Sofá con cojines
    const tela = mat('#4f6a87', 0.95), sofa = new THREE.Group(); sofa.position.set(-0.1, 0, -1.3); scene.add(sofa);
    mesh(box(2.1, 0.26, 0.85), tela, sofa, [0, 0.17, 0]);
    for (const x of [-0.66, 0, 0.66]) mesh(box(0.64, 0.14, 0.7), tela, sofa, [x, 0.37, 0.05]);
    mesh(box(2.1, 0.5, 0.22), tela, sofa, [0, 0.55, -0.32]);
    for (const x of [-1.0, 1.0]) mesh(box(0.2, 0.58, 0.85), tela, sofa, [x, 0.29, 0]);
    mesh(box(0.38, 0.32, 0.1), mat('#e5bc44', 0.95), sofa, [-0.6, 0.6, -0.15], null, [-0.2, 0.25, 0]);
    mesh(box(0.36, 0.3, 0.1), mat('#d9684a', 0.95), sofa, [0.55, 0.6, -0.15], null, [-0.2, -0.2, 0]);
    for (const x of [-0.95, 0.95]) for (const z of [-0.35, 0.35]) mesh(cyl(0.02, 0.015, 0.06, 8), mat('#2b2018', 0.6), sofa, [x, 0.03, z]);
    // Alfombra, mesa de centro y vasos
    mesh(box(1.7, 0.01, 1.2), surf(rug(['#7a3b2e', '#c9683f', '#efe0c4', '#2f6f7f']), [1, 1]), scene, [0.85, 0.005, -0.2], null, null, false);
    const madera = surf(wood(24, 0.36, 12), [1, 1]);
    mesh(box(0.9, 0.04, 0.5), madera, scene, [0.95, 0.4, -0.2]);
    for (const [x, z] of [[0.55, -0.4], [1.35, -0.4], [0.55, 0], [1.35, 0]]) mesh(cyl(0.02, 0.02, 0.38, 8), mat('#3e2b1e', 0.6), scene, [x, 0.19, z]);
    mesh(cyl(0.035, 0.028, 0.1, 16), mat('#d7392f', 0.35), scene, [0.8, 0.47, -0.25]);
    mesh(cyl(0.035, 0.028, 0.1, 16), mat('#2f6fd7', 0.35), scene, [1.05, 0.47, -0.1]);
    mesh(cyl(0.08, 0.05, 0.05, 20), mat('#efe9df', 0.3), scene, [1.2, 0.445, -0.3]);
    // Planta y bocina
    mesh(cyl(0.14, 0.11, 0.3), mat('#b0603c', 0.8), scene, [1.25, 0.15, -1.5]);
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2;
      mesh(new THREE.SphereGeometry(0.12, 10, 8), mat(i % 2 ? '#3f7a3a' : '#4f8c45', 0.8), scene, [1.25 + Math.cos(a) * 0.12, 0.45 + (i % 3) * 0.08, -1.5 + Math.sin(a) * 0.12], [0.7, 1.3, 0.7]);
    }
    mesh(box(0.28, 0.6, 0.28), mat('#1c1e22', 0.5), scene, [1.3, 0.3, -0.95]);
    mesh(cyl(0.08, 0.08, 0.01, 20), mat('#3a3d44', 0.4), scene, [1.3, 0.38, -0.81], null, [Math.PI / 2, 0, 0]);
    // Luces de fiesta
    const bombillas = new THREE.Group(); scene.add(bombillas);
    for (let i = 0; i < 18; i++) {
      const x = -1.3 + i * 0.16, y = 2.15 - Math.sin(i / 17 * Math.PI) * 0.18;
      const c = ['#ffd36b', '#ff9a6b', '#9fd8ff', '#ffe9a8'][i % 4];
      mesh(new THREE.SphereGeometry(0.022, 10, 8), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2.2 }), bombillas, [x, y, -1.7], null, null, false);
    }
    const calida = new THREE.PointLight(0xffc98a, 1.2, 4, 2); calida.position.set(0, 2, -1.3); scene.add(calida);
    zocalo(mat('#f4efe6', 0.5)); rincones();
  } else if (id === 'xilazina') {
    floor(surf(concrete(), [3, 3]));
    wall(surf(bricks(), [5, 2.2]));
    // Contenedor de basura con tapa y ruedas
    const verde = mat('#2f5a44', 0.55, { metalness: 0.3 }), cont = new THREE.Group(); cont.position.set(0.75, 0, -1.3); cont.rotation.y = -0.08; scene.add(cont);
    mesh(box(1.4, 0.85, 0.75), verde, cont, [0, 0.5, 0]);
    mesh(box(1.44, 0.05, 0.8), mat('#244636', 0.6, { metalness: 0.3 }), cont, [0, 0.96, 0.02], null, [0.12, 0, 0]);
    for (const x of [-0.6, 0.6]) for (const z of [-0.28, 0.28]) mesh(cyl(0.05, 0.05, 0.04, 14), mat('#1a1a1a', 0.7), cont, [x, 0.05, z], null, [0, 0, Math.PI / 2]);
    // Cajas de cartón, cartón en el piso y bolsa
    const carton = mat('#a58b62', 0.95);
    mesh(box(0.45, 0.35, 0.4), carton, scene, [-1.1, 0.175, -1.35], null, [0, 0.3, 0]);
    mesh(box(0.35, 0.28, 0.32), mat('#9a7f57', 0.95), scene, [-1.12, 0.49, -1.36], null, [0, -0.2, 0]);
    mesh(box(0.55, 0.012, 0.42), carton, scene, [-0.9, 0.006, 0.9], null, [0, 0.3, 0]);
    mesh(new THREE.SphereGeometry(0.22, 16, 12), mat('#15171a', 0.25), scene, [-0.1, 0.16, -1.48], [1, 0.75, 0.9]);
    // Tubo en la pared y charco de agua
    mesh(cyl(0.035, 0.035, 2.6, 14), mat('#7d858c', 0.4, { metalness: 0.7 }), scene, [-0.55, 1.3, -1.7]);
    const agua = puddle(0.32, 7, new THREE.MeshPhysicalMaterial({ color: '#3d4449', roughness: 0.04, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.55 }));
    agua.position.set(0.7, 0.001, 0.9); scene.add(agua);
    rincones();
  } else if (id === 'tardio') {
    floor(surf(wood(22, 0.44, 7), [4, 4]));
    wall(surf(plaster('#e3e7ef'), [5, 2]));
    // Cama con cabecera, sábana, frisa y almohada
    const madera = surf(wood(22, 0.33, 12), [1, 1]), cama = new THREE.Group(); cama.position.set(-0.95, 0, 0.05); scene.add(cama);
    mesh(box(1.1, 0.3, 2.0), madera, cama, [0, 0.15, 0]);
    mesh(box(1.12, 0.9, 0.06), madera, cama, [0, 0.45, -1.02]);
    mesh(box(1.04, 0.18, 1.92), mat('#eef2f7', 0.95), cama, [0, 0.39, 0]);
    mesh(box(1.08, 0.06, 1.25), mat('#4f6f9c', 0.95), cama, [0, 0.5, 0.35]);
    mesh(box(0.06, 0.32, 1.25), mat('#4f6f9c', 0.95), cama, [0.54, 0.36, 0.35]);
    mesh(box(0.62, 0.12, 0.34), mat('#ffffff', 0.95), cama, [0, 0.54, -0.75]);
    // Mesa de noche con lámpara encendida
    mesh(box(0.42, 0.5, 0.4), madera, scene, [0.75, 0.25, -1.45]);
    mesh(cyl(0.05, 0.07, 0.04, 16), mat('#3a3d44', 0.4), scene, [0.75, 0.52, -1.45]);
    mesh(cyl(0.012, 0.012, 0.22, 8), mat('#3a3d44', 0.4), scene, [0.75, 0.65, -1.45]);
    mesh(cyl(0.08, 0.13, 0.16, 20, true), new THREE.MeshStandardMaterial({ color: '#f5e6c8', emissive: '#ffd99a', emissiveIntensity: 1.2, side: THREE.DoubleSide }), scene, [0.75, 0.8, -1.45]);
    const lampara = new THREE.PointLight(0xffc98a, 0.8, 3, 2); lampara.position.set(0.75, 0.78, -1.4); scene.add(lampara);
    // Alfombra y cuadro
    mesh(box(1.5, 0.01, 1.0), surf(rug(['#5a4a6b', '#c9b38a', '#8a5a4a', '#e8dcc4']), [1, 1]), scene, [0.3, 0.005, 0.2], null, null, false);
    mesh(box(0.7, 0.5, 0.02), mat('#6b5442', 0.6), scene, [0.05, 1.55, -1.735], null, null, false);
    mesh(new THREE.PlaneGeometry(0.62, 0.42), mat('#8ab0c9', 0.9), scene, [0.05, 1.55, -1.723], null, null, false);
    zocalo(mat('#f2f4f7', 0.5)); rincones();
  }
}

// ---------- Sombra de contacto del cuerpo ----------
export function contactShadow() {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shade(gradTex(), 0.42));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.003; m.renderOrder = 2;
  return m;
}

// ---------- Charco (vómito y agua) ----------
// Disco con borde irregular y domo bajo. R es el radio medio y s la semilla.
function puddle(R, s, material, alto = 0.0015) {
  const seg = 56, rings = 6, pos = [], col = [], idx = [];
  const fase = [hash(s, 1, 1), hash(s, 2, 1), hash(s, 3, 1)].map((x) => x * Math.PI * 2);
  const borde = (a) => 1 + 0.22 * Math.sin(3 * a + fase[0]) + 0.13 * Math.sin(5 * a + fase[1]) + 0.07 * Math.sin(9 * a + fase[2]);
  pos.push(0, alto, 0); col.push(1, 1, 1);
  for (let r = 1; r <= rings; r++) for (let i = 0; i < seg; i++) {
    const a = i / seg * Math.PI * 2, t = r / rings, rr = R * t * borde(a);
    const y = alto * Math.sqrt(Math.max(0, 1 - t * t)) * (0.85 + 0.3 * hash(r, i, s));
    pos.push(Math.cos(a) * rr * 1.25, y, Math.sin(a) * rr * 0.85);
    const k = 0.92 + 0.16 * hash(i, r, s + 9) - t * 0.06; col.push(k, k, k);
  }
  for (let i = 0; i < seg; i++) idx.push(0, 1 + ((i + 1) % seg), 1 + i);
  for (let r = 1; r < rings; r++) for (let i = 0; i < seg; i++) {
    const a = 1 + (r - 1) * seg + i, b = 1 + (r - 1) * seg + ((i + 1) % seg), c = a + seg, d = b + seg;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  material.vertexColors = true;
  const m = new THREE.Mesh(g, material); m.receiveShadow = true;
  return m;
}

// Vómito: charco amarillento brillante con grumos y salpicaduras. Se coloca junto a la boca en scene.js.
export function vomitPuddle() {
  const g = new THREE.Group();
  const liquido = () => new THREE.MeshPhysicalMaterial({ color: '#b7a443', roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.06, transparent: true, opacity: 0.94 });
  g.add(puddle(0.11, 3, liquido(), 0.006));
  for (const [x, z, r, s] of [[0.16, 0.05, 0.028, 5], [-0.14, 0.07, 0.022, 6], [0.07, -0.12, 0.018, 8]]) { const p = puddle(r, s, liquido(), 0.002); p.position.set(x, 0, z); g.add(p); }
  const grumo = [mat('#d5bf73', 0.45), mat('#8f7b38', 0.5), mat('#c9a95a', 0.45)];
  for (let i = 0; i < 11; i++) {
    const a = hash(i, 4, 2) * Math.PI * 2, r = 0.075 * Math.sqrt(hash(i, 5, 2)), s = 0.005 + 0.007 * hash(i, 6, 2);
    mesh(new THREE.DodecahedronGeometry(1, 0), grumo[i % 3], g, [Math.cos(a) * r * 1.2, 0.005, Math.sin(a) * r * 0.85], [s, s * 0.55, s * 0.9], [hash(i, 7, 2) * 3, hash(i, 8, 2) * 3, 0], false);
  }
  g.visible = false;
  return g;
}
