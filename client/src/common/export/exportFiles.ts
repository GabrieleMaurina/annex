import { strToU8, zipSync } from 'fflate';
import type { ExportData } from '../../lib/types';

export type ExportFormat = 'json' | 'csv';

type Row = Record<string, unknown>;

const FORMULA_START = /^[=+\-@\t\r]/;
const BYTE_ORDER_MARK = '\uFEFF';

function isRecord(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function flatten(row: Row, prefix = '', out: Row = {}): Row {
  for (const [key, value] of Object.entries(row)) {
    if (isRecord(value)) flatten(value, `${prefix}${key}.`, out);
    else out[prefix + key] = Array.isArray(value) ? value.join('; ') : value;
  }
  return out;
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text =
    typeof value === 'string' && FORMULA_START.test(value)
      ? `'${value}`
      : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: Row[]): string {
  const flat = rows.map((row) => flatten(row));
  const columns = [...new Set(flat.flatMap((row) => Object.keys(row)))];
  const lines = [columns, ...flat.map((row) => columns.map((c) => row[c]))];
  return lines.map((line) => line.map(cell).join(',')).join('\r\n') + '\r\n';
}

function collectTables(
  path: string,
  value: unknown,
  tables: Map<string, Row[]>,
): void {
  if (Array.isArray(value)) {
    if (value.length > 0) tables.set(path, value as Row[]);
    return;
  }
  if (!isRecord(value)) return;
  const entries = Object.entries(value);
  if (entries.length > 0 && entries.every(([, v]) => Array.isArray(v)))
    for (const [key, v] of entries) collectTables(`${path}/${key}`, v, tables);
  else tables.set(path, [value]);
}

function zipTables(data: ExportData): Uint8Array<ArrayBuffer> {
  const tables = new Map<string, Row[]>();
  for (const [key, value] of Object.entries(data))
    collectTables(key, value, tables);
  return zipSync(
    Object.fromEntries(
      [...tables].map(([path, rows]) => [
        `${path}.csv`,
        strToU8(BYTE_ORDER_MARK + toCsv(rows)),
      ]),
    ),
  ) as Uint8Array<ArrayBuffer>;
}

function fileSlug(name: string): string {
  return (
    name
      .replace(/[^\p{L}\p{N}_-]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'export'
  );
}

function save(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function downloadExport(
  data: ExportData,
  format: ExportFormat,
  name: string,
): void {
  const base = `annex-${String(data.kind)}-${fileSlug(name)}`;
  if (format === 'json')
    save(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      `${base}.json`,
    );
  else
    save(
      new Blob([zipTables(data)], { type: 'application/zip' }),
      `${base}.zip`,
    );
}
