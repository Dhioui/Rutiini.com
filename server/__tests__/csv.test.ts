import { describe, it, expect } from 'vitest';
import { csvCell, csvRow, csvFile } from '../csv';

describe('csvCell', () => {
  it('quotes every value', () => {
    expect(csvCell('Aatos')).toBe('"Aatos"');
    expect(csvCell(7)).toBe('"7"');
  });

  it('doubles a quote inside a value', () => {
    expect(csvCell('Ville "Vili" Aho')).toBe('"Ville ""Vili"" Aho"');
  });

  it('keeps a comma or newline inside one field', () => {
    expect(csvCell('nukkui 13:00, heräsi 14:30')).toBe('"nukkui 13:00, heräsi 14:30"');
    expect(csvCell('rivi1\nrivi2')).toBe('"rivi1\nrivi2"');
  });

  it('renders an empty cell for a missing value', () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
    expect(csvCell('')).toBe('""');
  });

  it('leaves ordinary Finnish text exactly as typed', () => {
    expect(csvCell('läsnäolo, ei huomautettavaa')).toBe('"läsnäolo, ei huomautettavaa"');
    expect(csvCell('28.8.2026')).toBe('"28.8.2026"');
  });

  // A daycare leader opens these reports in Excel, and the values in them are typed
  // by other people: a guardian names a child, a member of staff writes the day's
  // entry. Excel runs a cell that opens with one of these characters as a formula.
  describe('text that Excel would otherwise run as a formula', () => {
    it.each([
      ['=HYPERLINK("http://evil.example/steal","Klikkaa")'],
      ['=1+1'],
      ['+1234567890'],
      ['-2+3'],
      ['@SUM(A1:A9)'],
      ['=cmd|\'/c calc\'!A1'],
    ])('makes %s text rather than a formula', (dangerous) => {
      const cell = csvCell(dangerous);
      expect(cell.startsWith('"\'')).toBe(true);
      // The characters themselves are kept, so the report still shows what was typed.
      expect(cell).toContain(dangerous.replace(/"/g, '""'));
    });

    it('sees through leading whitespace', () => {
      expect(csvCell('   =1+1')).toBe('"\'   =1+1"');
      expect(csvCell('\t=1+1')).toBe('"\'\t=1+1"');
    });

    it('does not disturb a value that merely contains those characters', () => {
      expect(csvCell('Matti-Pekka')).toBe('"Matti-Pekka"');
      expect(csvCell('paino 12+2 kg')).toBe('"paino 12+2 kg"');
      expect(csvCell('etunimi@example.fi')).toBe('"etunimi@example.fi"');
    });
  });
});

describe('csvRow', () => {
  it('separates cells with a comma', () => {
    expect(csvRow(['a', 'b', 3])).toBe('"a","b","3"');
  });
});

describe('csvFile', () => {
  it('opens with the byte order mark Excel needs to read UTF-8', () => {
    expect(csvFile(['Nimi'], [['Läsnäolo']]).charCodeAt(0)).toBe(0xfeff);
  });

  it('puts the header first and one line per row', () => {
    const file = csvFile(['ID', 'Nimi'], [[1, 'Aatos'], [2, 'Emilia']]);
    expect(file.slice(1).split('\n')).toEqual([
      '"ID","Nimi"',
      '"1","Aatos"',
      '"2","Emilia"',
    ]);
  });

  it('writes just the header when there is nothing to report', () => {
    expect(csvFile(['ID', 'Nimi'], []).slice(1)).toBe('"ID","Nimi"');
  });

  it('produces a file a CSV reader parses back to the original values', () => {
    const values = [
      ['Ville "Vili" Aho', 'nukkui 13:00, heräsi 14:30'],
      ['Änni Öström', 'rivi1\nrivi2'],
    ];
    const parsed = parseCsv(csvFile(['Lapsi', 'Sisältö'], values).slice(1));

    expect(parsed[0]).toEqual(['Lapsi', 'Sisältö']);
    expect(parsed.slice(1)).toEqual(values);
  });
});

/** A minimal RFC 4180 reader, so the assertion above is about the format itself. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  row.push(field);
  rows.push(row);
  return rows;
}
