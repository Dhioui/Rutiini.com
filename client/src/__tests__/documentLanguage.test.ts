/**
 * The document's language and reading direction.
 *
 * The bug being guarded is not "the mapping is wrong" -- it never was. It is
 * *when* the mapping ran: only inside the language menu's click handler, so a
 * reload restored Arabic text into a left-to-right layout. The last test here is
 * therefore the important one: it imports i18n.ts with Arabic already saved, the
 * way a returning guardian's browser has it, and touches no menu at all.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  baseLanguage,
  documentDirection,
  applyDocumentLanguage,
} from '@/lib/documentLanguage';

describe('reading direction', () => {
  it('is right to left for Arabic', () => {
    expect(documentDirection('ar')).toBe('rtl');
  });

  it('is left to right for the other five languages', () => {
    for (const language of ['fi', 'en', 'sv', 'ru', 'so']) {
      expect(documentDirection(language)).toBe('ltr');
    }
  });

  it('ignores a region suffix, which the browser may supply', () => {
    // navigator.language is "ar-SA", not "ar".
    expect(documentDirection('ar-SA')).toBe('rtl');
    expect(baseLanguage('fi-FI')).toBe('fi');
  });

  it('falls back to Finnish rather than leaving the attribute empty', () => {
    expect(baseLanguage(undefined)).toBe('fi');
    expect(documentDirection(undefined)).toBe('ltr');
  });
});

describe('writing the attributes', () => {
  it('sets both lang and dir', () => {
    const element = { lang: 'en', dir: 'ltr' };
    applyDocumentLanguage('ar', element);
    expect(element).toEqual({ lang: 'ar', dir: 'rtl' });
  });

  it('sets lang for a left-to-right language too', () => {
    // index.html says lang="en" and nothing used to change it, so a Finnish page
    // announced itself as English.
    const element = { lang: 'en', dir: 'ltr' };
    applyDocumentLanguage('fi', element);
    expect(element).toEqual({ lang: 'fi', dir: 'ltr' });
  });

  it('does nothing outside a browser instead of throwing', () => {
    expect(() => applyDocumentLanguage('ar', undefined)).not.toThrow();
  });
});

describe('applying it when the application starts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('writes the attributes on import, with no menu click involved', async () => {
    // What index.html ships with.
    const documentElement = { lang: 'en', dir: '' };
    vi.stubGlobal('document', { documentElement, cookie: '' });

    const i18n = (await import('@/i18n')).default;

    // If nothing applied the language at startup, lang would still read "en" and
    // dir would still be empty. That was the bug.
    expect(documentElement.lang).toBe('fi');
    expect(documentElement.dir).toBe('ltr');

    // And it keeps following the language afterwards, whatever changed it --
    // here through i18next directly rather than through the menu component.
    await i18n.changeLanguage('ar');
    expect(documentElement).toEqual({ lang: 'ar', dir: 'rtl' });
  });
});
