// ESLint: reglas recomendadas para el código nuevo en TypeScript (con React Hooks) y para el JavaScript clásico.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/**', 'dist-arbol/**', 'dist-web/**', 'test-results/**', 'playwright-report/**', 'node_modules/**', 'prototipo/**', 'blender/**', 'modelos/**'] },
  {
    files: ['e2e/**/*.ts', 'playwright.config.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['src/**/*.js', 'scripts/**/*.js', '*.config.js'],
    extends: [js.configs.recommended],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: globals.browser },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
