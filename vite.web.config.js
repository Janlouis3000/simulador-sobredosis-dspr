import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build de sitio estático para publicar con un enlace o dentro de un iframe: `npm run build:web` → dist-web/.
// A diferencia de los builds de un solo archivo, aquí cada pieza va aparte y se carga cuando hace falta:
// React solo en arbol.html, three.js solo en index.html (simulador clásico) y cada modelo GLB solo cuando se
// escoge su caso. Las rutas son relativas (base './'): funciona en cualquier carpeta del servidor.
//
// Política de seguridad (CSP) en una etiqueta <meta>. Lo que no se puede poner en <meta> (frame-ancestors, que
// decide qué sitios pueden meterlo en un iframe) va como encabezado del servidor: ver docs/despliegue.md.
const CSP = [
  "default-src 'self'",
  // 'wasm-unsafe-eval' solo permite WebAssembly (el descompresor meshopt de los modelos); no permite eval de JS.
  "script-src 'self' 'wasm-unsafe-eval'",
  // 'unsafe-inline' en estilos: atributos style de React (ancho de la barra de agitación) y del aviso de index.html.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  // data: y blob: para las texturas de los modelos (scene.js las pasa a data URL) y los logos.
  "img-src 'self' data: blob:",
  "connect-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com",
  "worker-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const csp = {
  name: 'dspr-csp',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="${CSP}">`),
};

export default defineConfig({
  base: './',
  plugins: [react(), csp],
  build: {
    outDir: 'dist-web',
    emptyOutDir: true,
    // three.js solo ya pesa unos 700 KB sin comprimir (190 KB con gzip); solo lo carga el simulador clásico.
    chunkSizeWarningLimit: 800,
    rollupOptions: { input: { index: 'index.html', arbol: 'arbol.html' } },
  },
});
