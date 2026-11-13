import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Build de la prueba vertical del árbol de decisiones: dist-arbol/arbol.html, un solo archivo como el clásico.
// En la fase 4 se agrega el build de sitio estático (varios archivos, carga diferida) para enlace e iframe.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  build: { outDir: 'dist-arbol', emptyOutDir: true, rollupOptions: { input: 'arbol.html' } },
});
