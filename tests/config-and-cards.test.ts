import { test, expect } from 'bun:test';
import { resolveApiUrl } from '../src/lib/apiUrl';
import { getCardValue } from '../src/lib/cards';
import en from '../src/locales/en.json';
import ru from '../src/locales/ru.json';
import { Glob } from 'bun';

test('production requires a valid API URL', () => {
  expect(() => resolveApiUrl(undefined, true)).toThrow();
  for (const value of ['javascript:alert(1)', '/api', 'https://name:secret@example.com', 'https://example.com?key=secret']) {
    expect(() => resolveApiUrl(value, true)).toThrow();
  }
  expect(resolveApiUrl(' https://example.com/api/ ', true)).toBe('https://example.com/api');
  expect(resolveApiUrl(undefined)).toBe('http://localhost:3000');
});

test('each card uses the selected field and hint, including mixed custom keys', () => {
  expect(getCardValue({ original: 'word', customFields: { Example: 'chosen', phonetic: 'other' } }, 'example')).toBe('chosen');
  expect(getCardValue({ customFields: { example: 'next' } }, 'EXAMPLE')).toBe('next');
  expect(getCardValue({ original: 'word' }, 'none')).toBe('—');
  expect(getCardValue({ customFields: null }, 'example')).toBe('—');
  expect(getCardValue({ customFields: { count: 0 } }, 'count')).toBe('0');
});

test('literal translation keys exist in both supported languages', async () => {
  const hasKey = (resource: object, key: string) => key.split('.').reduce((value, part) => value?.[part], resource);
  for (const file of new Glob('src/**/*.{ts,tsx}').scanSync('.')) {
    const source = await Bun.file(file).text();
    for (const match of source.matchAll(/\bt\(['"]([^'"`]+)['"]/g)) {
      if (match[1].endsWith('.')) continue;
      expect(hasKey(en, match[1]), `${file}: en ${match[1]}`).toBeDefined();
      expect(hasKey(ru, match[1]), `${file}: ru ${match[1]}`).toBeDefined();
    }
  }
});
