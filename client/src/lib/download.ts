import { apiUrl } from '@/lib/api';

/**
 * Download a file from an authenticated endpoint.
 *
 * The report buttons used to do `window.location.href = '/api/export/children'`,
 * which is a plain navigation: it carries no Authorization header, and the session
 * lives in one rather than in a cookie. Every export therefore answered
 * 401 {"error":"No token provided"} and the daycare leader was left looking at a
 * line of JSON where a spreadsheet should have been.
 *
 * Fetching it instead means the request is authenticated like any other, and the
 * file is handed to the browser from memory.
 */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const token = localStorage.getItem('token');

  const response = await fetch(apiUrl(path), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`${response.status}: ${await response.text()}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  // The server names the file, including the date range it covers; that name is
  // more useful than anything guessed here. It is transliterated first, because a
  // browser silently discards a non-ASCII name on a download of this kind: the
  // reports called "merkinnät" and "läsnäolo" were saved as a file named
  // "download", with no extension, which Windows then would not open.
  link.download = asciiFilename(
    filenameFrom(response.headers.get('Content-Disposition')) ?? fallbackName,
  );

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * The filename the server asked for, if it asked for one.
 *
 * Handles both `filename="lapset.csv"` and the RFC 5987 `filename*=UTF-8''...`
 * form, which is what a name containing ä or ö arrives as.
 */
export function filenameFrom(header: string | null): string | null {
  if (!header) return null;

  const extended = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (extended) {
    try {
      return decodeURIComponent(extended[1].trim());
    } catch {
      // Malformed encoding; fall through to the plain form.
    }
  }

  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1].trim() : null;
}

/**
 * The same name, in characters a browser will keep.
 *
 * Diacritics are stripped rather than replaced wholesale, so "läsnäolo" stays
 * readable as "lasnaolo" instead of turning into "l_sn_olo".
 */
export function asciiFilename(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '_');
}
