/**
 * Keeps `<html lang>` and `<html dir>` in step with the language actually in use.
 *
 * Both were previously set inside the language menu's click handler, so they were
 * only ever correct until the next reload. i18next restores the saved language
 * from localStorage at startup without anyone clicking anything, so a guardian
 * who had chosen Arabic came back to Arabic text laid out left to right.
 *
 * `lang` was worse: nothing set it at all. index.html declares `lang="en"`, so
 * every page announced itself as English to a screen reader whatever language it
 * was actually showing -- Finnish included, which is the default.
 *
 * Kept in its own module rather than inside i18n.ts so the mapping can be tested
 * without initialising i18next and without a browser.
 */

/** Of the six languages offered, Arabic is the one written right to left. */
const RTL_LANGUAGES = new Set(['ar']);

/** "ar-SA" and "ar" are the same language as far as these attributes go. */
export function baseLanguage(language: string | undefined): string {
  return (language || 'fi').split('-')[0];
}

export function documentDirection(language: string | undefined): 'rtl' | 'ltr' {
  return RTL_LANGUAGES.has(baseLanguage(language)) ? 'rtl' : 'ltr';
}

/**
 * Writes both attributes onto the root element.
 *
 * `element` is the real document element in a browser and a plain object in a
 * test. It is left undefined outside a browser -- a build step or a Node test
 * importing this module must not throw on a missing `document`.
 */
export function applyDocumentLanguage(
  language: string | undefined,
  element: { lang: string; dir: string } | undefined =
    typeof document === 'undefined' ? undefined : document.documentElement,
): void {
  if (!element) return;

  element.lang = baseLanguage(language);
  element.dir = documentDirection(language);
}
