/** Parse a CSV file with quoted fields, escaped quotes, commas and newlines. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  let afterQuote = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') { quoted = false; afterQuote = true; }
      else cell += char;
    } else if (afterQuote) {
      if (char === ',') { row.push(cell); cell = ''; afterQuote = false; }
      else if (char === '\n' || char === '\r') {
        if (char === '\r' && text[i + 1] === '\n') i += 1;
        row.push(cell); rows.push(row); row = []; cell = ''; afterQuote = false;
      } else if (char === ' ' || char === '\t') {
        // Spaces after a closing quote are harmless and ignored.
      } else {
        throw new Error('CSV memiliki karakter di luar tanda kutip setelah kolom tertutup.');
      }
    } else if (char === '"') {
      if (cell.trim() !== '') throw new Error('Tanda kutip CSV harus dimulai di awal kolom.');
      cell = '';
      quoted = true;
    } else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += char;
  }
  if (quoted) throw new Error('CSV memiliki tanda kutip yang belum ditutup.');
  if (afterQuote || cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  const nonEmpty = rows.filter((r) => r.some((v) => v.trim() !== ''));
  if (nonEmpty.length < 2) throw new Error('CSV harus memiliki baris header dan minimal satu baris data.');
  const headers = nonEmpty[0].map((h) => h.trim().replace(/^\uFEFF/, '').toLowerCase());
  if (new Set(headers).size !== headers.length) throw new Error('CSV memiliki nama kolom duplikat.');
  return nonEmpty.slice(1).map((values) => Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? '').trim()])));
}

export function csvCell(value) {
  let text = value == null ? '' : String(value);
  // Prefix spreadsheet formula-like text even when whitespace precedes the operator.
  if (/^\s*[=+@-]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows, columns) {
  return [columns, ...rows.map((r) => columns.map((c) => csvCell(r[c])))].map((r) => r.join(',')).join('\r\n') + '\r\n';
}

export function parseRupiah(value) {
  const input = value.trim().replace(/^rp\s*/i, '').replace(/\s/g, '');
  const valid = /^\d+$/.test(input) || /^\d{1,3}(?:\.\d{3})+$/.test(input) || /^\d{1,3}(?:,\d{3})+$/.test(input);
  if (!valid) return null;
  const number = Number(input.replace(/[.,]/g, ''));
  return Number.isSafeInteger(number) && number >= 0 && number <= 99_999_999 ? number : null;
}
