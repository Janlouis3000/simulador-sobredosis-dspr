// Pruebas de interfaz (Playwright + axe-core) sobre el build web (dist-web/). `npm run test:e2e` construye y prueba.
// Usan el Microsoft Edge instalado (channel 'msedge'): no hace falta bajar los navegadores de Playwright.
import { defineConfig, devices } from '@playwright/test';

const PUERTO = 4180;

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PUERTO}/`, channel: 'msedge', trace: 'off' },
  webServer: {
    command: `node node_modules/vite/bin/vite.js preview --config vite.web.config.js --port ${PUERTO} --strictPort`,
    url: `http://localhost:${PUERTO}/arbol.html`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Edge'], channel: 'msedge' }, testIgnore: /sin-webgl|movil/ },
    { name: 'telefono', use: { channel: 'msedge', viewport: { width: 400, height: 800 }, isMobile: false, hasTouch: true }, testMatch: /movil/ },
    { name: 'sin-webgl', use: { channel: 'msedge', launchOptions: { args: ['--disable-webgl', '--disable-3d-apis'] } }, testMatch: /sin-webgl/ },
  ],
});
