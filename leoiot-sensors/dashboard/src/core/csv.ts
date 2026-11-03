// InfluxDB answers Flux queries as annotated CSV: optional annotation lines starting with `#`,
// then a header row and data rows per table, tables separated by an empty line, every table with
// its own header. This reads that into records, without a library.

export type CsvRecord = Record<string, string>;

/** Splits CSV text into rows of cells (RFC 4180 quoting: `"` doubles inside quoted cells, newlines allowed there). */
function splitRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let any = false; // something other than the line break was seen on this line
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') (cell += '"', i++);
        else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"' && cell === '') (quoted = true, any = true);
    else if (c === ',') (row.push(cell), cell = '', any = true);
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      if (any || cell !== '') row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      any = false;
    } else (cell += c, any = true);
  }
  if (any || cell !== '' || row.length > 0) (row.push(cell), rows.push(row));
  return rows;
}

/**
 * All data rows of all tables as records keyed by their table's header. Annotation rows and the
 * empty first column are skipped. An error table (`error,reference`) throws with the server's message.
 */
export function parseAnnotatedCsv(text: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let header: string[] | null = null;
  for (const row of splitRows(text)) {
    if (row.length === 0 || (row.length === 1 && row[0] === '')) {
      header = null; // an empty line ends a table
      continue;
    }
    if (row[0].startsWith('#')) continue;
    if (header === null) {
      header = row;
      continue;
    }
    const record: CsvRecord = {};
    header.forEach((name, i) => {
      if (name !== '') record[name] = row[i] ?? '';
    });
    if ('error' in record && 'reference' in record && header.length <= 3) {
      throw new Error(`InfluxDB: ${record.error}`);
    }
    records.push(record);
  }
  return records;
}
