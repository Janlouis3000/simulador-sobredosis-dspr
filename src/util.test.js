import { describe, expect, test } from 'vitest';
import { esc, fmt } from './util.js';

describe('utilidades de texto', () => {
  test('escapa caracteres que pueden crear marcado HTML', () => {
    expect(esc(`<script title="x">'&</script>`)).toBe('&lt;script title=&quot;x&quot;&gt;&#39;&amp;&lt;/script&gt;');
  });

  test('convierte valores nulos en una cadena vacía antes de escaparlos', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });

  test('mantiene el formato de tiempo mm:ss', () => {
    expect(fmt(0)).toBe('00:00');
    expect(fmt(65)).toBe('01:05');
    expect(fmt(600)).toBe('10:00');
  });
});
