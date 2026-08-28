/**
 * CSV cells for the exported reports.
 *
 * Quoting, and doubling any quote inside a value, is the format itself: a child
 * called Ville "Vili" Aho or an entry mentioning 30 cm, 40 cm would otherwise split
 * a row across the wrong columns.
 *
 * The leading apostrophe is about the reader rather than the format. These reports
 * are opened in Excel -- that is why they carry a byte order mark -- and Excel
 * treats a cell beginning with =, +, - or @ as a formula rather than as text. The
 * values here are typed by people: a child's name, the free text of a daily entry,
 * the reason given for an absence. A name entered as =1+1 is merely confusing, but
 * the same position accepts things like =HYPERLINK(...) or a DDE call, so what a
 * guardian or a member of staff types would be executed on the leader's machine
 * when they open the day's report. Prefixing an apostrophe makes Excel read the
 * cell as text and show exactly the characters that were typed.
 */
export function csvCell(value: unknown): string {
  const text = String(value ?? '');

  // Leading whitespace does not stop Excel from parsing what follows as a formula,
  // so the character being tested for is the first one that is not whitespace.
  const opensAFormula = /^[\s]*[=+\-@]/.test(text) || /^[\t\r]/.test(text);

  return `"${(opensAFormula ? `'${text}` : text).replace(/"/g, '""')}"`;
}

/** One CSV line. */
export function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(',');
}

/**
 * A whole file: a byte order mark so Excel reads it as UTF-8 -- without it the
 * Finnish ä and ö arrive as mojibake -- then the header and the rows.
 */
export function csvFile(headers: string[], rows: unknown[][]): string {
  return '\uFEFF' + [csvRow(headers), ...rows.map(csvRow)].join('\n');
}
