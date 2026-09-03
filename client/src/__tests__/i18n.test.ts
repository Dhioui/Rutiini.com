/**
 * Guards translation completeness.
 *
 * i18next is configured with fallbackLng: 'fi', so a key missing from a language
 * does not fail loudly -- it renders Finnish text inside an otherwise Arabic,
 * Somali, Russian or Swedish interface. That is exactly the failure the
 * multilingual promise exists to prevent, and it previously affected the GDPR
 * export and deletion flows. This test makes a regression fail in CI instead.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const LANGUAGES = ['fi', 'en', 'sv', 'ar', 'ru', 'so'] as const;
const REFERENCE = 'fi';

function translationKeys(source: string, lang: string): Set<string> {
  const header = new RegExp(`\\n  ${lang}: \\{\\s*\\n\\s*translation: \\{`);
  const match = header.exec(source);
  if (!match) throw new Error(`No translation block found for "${lang}"`);

  const start = match.index + match[0].length;
  let depth = 1;
  let i = start;
  while (i < source.length && depth > 0) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') depth--;
    i++;
  }

  const body = source.slice(start, i - 1);
  return new Set(Array.from(body.matchAll(/^\s+([A-Za-z0-9_]+):/gm), (m) => m[1]));
}

const source = readFileSync(join(__dirname, '..', 'i18n.ts'), 'utf-8');
const keysByLanguage = Object.fromEntries(
  LANGUAGES.map((lang) => [lang, translationKeys(source, lang)])
) as Record<(typeof LANGUAGES)[number], Set<string>>;

describe('i18n coverage', () => {
  it('defines a non-trivial reference vocabulary', () => {
    expect(keysByLanguage[REFERENCE].size).toBeGreaterThan(500);
  });

  for (const lang of LANGUAGES) {
    if (lang === REFERENCE) continue;

    it(`"${lang}" translates every key present in "${REFERENCE}"`, () => {
      const missing = [...keysByLanguage[REFERENCE]].filter((k) => !keysByLanguage[lang].has(k));
      expect(missing, `${lang} is missing ${missing.length} key(s): ${missing.join(', ')}`).toEqual([]);
    });
  }
});

/**
 * Every key the interface asks for, wherever it asks for it.
 *
 * The block above only compares the languages with each other, so a key that no
 * language defines passes it. That is the worse failure of the two: i18next
 * renders the key itself, and a toast that should have read "Lapsi poistettiin"
 * read "childDeleted" instead -- in every language at once. Twenty-two keys were
 * in that state when this was added.
 *
 * A default passed as the second argument does not make a key optional. It is
 * one language's text hard-coded into all six, which is the same failure wearing
 * a suit.
 */
function keysUsedInComponents(dir: string, found = new Map<string, string>()): Map<string, string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') keysUsedInComponents(path, found);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;

    const source = readFileSync(path, 'utf-8');
    // Only literal keys. `t(variable)` cannot be checked without running the app.
    for (const match of source.matchAll(/\bt\(\s*['"`]([A-Za-z0-9_]+)['"`]/g)) {
      if (!found.has(match[1])) found.set(match[1], path);
    }
  }
  return found;
}

describe('keys the interface actually uses', () => {
  const used = keysUsedInComponents(join(__dirname, '..'));

  it('finds the call sites, so an empty scan cannot pass silently', () => {
    expect(used.size).toBeGreaterThan(400);
  });

  it(`defines every one of them in "${REFERENCE}"`, () => {
    const undefinedKeys = [...used]
      .filter(([key]) => !keysByLanguage[REFERENCE].has(key))
      .map(([key, file]) => `${key} (${file.split('/client/src/')[1] ?? file})`);

    expect(
      undefinedKeys,
      `${undefinedKeys.length} key(s) render as their own name: ${undefinedKeys.join(', ')}`,
    ).toEqual([]);
  });
});
