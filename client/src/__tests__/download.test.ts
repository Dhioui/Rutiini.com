/**
 * The report buttons navigated straight to /api/export/..., which sends no
 * Authorization header. Every export answered 401 and the daycare leader was shown
 * a line of JSON instead of a spreadsheet. These pin the fetch-and-save behaviour
 * that replaced it.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { filenameFrom, asciiFilename } from '../lib/download';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' },
}));

describe('filenameFrom', () => {
  it('takes the name the server asked for', () => {
    expect(filenameFrom('attachment; filename="lapset-2026-08-24.csv"')).toBe(
      'lapset-2026-08-24.csv',
    );
  });

  it('decodes a name carrying Finnish characters', () => {
    expect(filenameFrom("attachment; filename*=UTF-8''l%C3%A4sn%C3%A4olo.csv")).toBe(
      'läsnäolo.csv',
    );
  });

  it('falls back when the header is absent or unparseable', () => {
    expect(filenameFrom(null)).toBeNull();
    expect(filenameFrom('attachment')).toBeNull();
  });
});

describe('downloadFile', () => {
  let clicked: string[];
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clicked = [];
    (globalThis as any).localStorage = {
      getItem: () => 'session-token',
      setItem: () => {},
      removeItem: () => {},
    };
    (globalThis as any).URL.createObjectURL = () => 'blob:report';
    (globalThis as any).URL.revokeObjectURL = () => {};
    (globalThis as any).document = {
      body: { appendChild: () => {}, removeChild: () => {} },
      createElement: () => ({
        href: '',
        download: '',
        click() {
          clicked.push(this.download);
        },
      }),
    };
  });

  afterEach(() => {
    delete (globalThis as any).document;
  });

  it('sends the session token, so the request is not rejected', async () => {
    fetchMock = vi.fn(async () => ({
      ok: true,
      headers: { get: () => 'attachment; filename="lapset-2026-08-24.csv"' },
      blob: async () => new Blob(['nimi;ika\n']),
    }));
    (globalThis as any).fetch = fetchMock;

    const { downloadFile } = await import('../lib/download');
    await downloadFile('/api/export/children', 'lapset.csv');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/export/children',
      expect.objectContaining({
        headers: { Authorization: 'Bearer session-token' },
      }),
    );
    expect(clicked).toEqual(['lapset-2026-08-24.csv']);
  });

  it('reports a refusal instead of saving an error page as a spreadsheet', async () => {
    (globalThis as any).fetch = vi.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => '{"error":"No token provided"}',
    }));

    const { downloadFile } = await import('../lib/download');
    await expect(downloadFile('/api/export/children', 'lapset.csv')).rejects.toThrow('401');
    expect(clicked).toEqual([]);
  });
});

describe('asciiFilename', () => {
  it('keeps a Finnish name readable while making it saveable', () => {
    // Chromium discards a non-ASCII name on this kind of download and saves the
    // file as "download" with no extension, so the diacritics have to go.
    expect(asciiFilename('merkinnät-2026-07-25.csv')).toBe('merkinnat-2026-07-25.csv');
    expect(asciiFilename('läsnäolo-2026-07-25.csv')).toBe('lasnaolo-2026-07-25.csv');
    expect(asciiFilename('påsk.csv')).toBe('pask.csv');
  });

  it('leaves an ASCII name untouched', () => {
    expect(asciiFilename('lapset-2026-08-24.csv')).toBe('lapset-2026-08-24.csv');
  });

  it('replaces what cannot be transliterated rather than dropping it', () => {
    expect(asciiFilename('раппортти.csv')).toBe('_________.csv');
  });
});
