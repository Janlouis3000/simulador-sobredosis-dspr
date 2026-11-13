import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` genera dist/index.html: un solo archivo con JS, CSS y logos embebidos,
// que se comparte y se abre con doble clic, sin servidor.
// En desarrollo (`npm run dev`) también se sirve /arbol.html, la prueba vertical del árbol de decisiones;
// su build va aparte (`npm run build:arbol`, vite.arbol.config.js).
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  build: { outDir: 'dist', emptyOutDir: true },
  test: { include: ['src/**/*.test.{js,ts,tsx}'] },
});
