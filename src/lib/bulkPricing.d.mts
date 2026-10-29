export type CsvRecord = Record<string, string>;
export function parseCsv(text: string): CsvRecord[];
export function csvCell(value: unknown): string;
export function toCsv(rows: Array<Record<string, unknown>>, columns: string[]): string;
export function parseRupiah(value: string): number | null;
