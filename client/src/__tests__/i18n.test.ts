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
import { readFileSync } from 'fs';
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
