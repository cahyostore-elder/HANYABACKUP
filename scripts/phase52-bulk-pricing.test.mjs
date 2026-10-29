import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseCsv, parseRupiah, toCsv } from '../src/lib/bulkPricing.mjs';

const admin = fs.readFileSync('src/pages/AdminPage.tsx', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20261028010000_phase52_supplier_cost_and_bulk_pricing.sql', 'utf8');

test('CSV parser handles commas, escaped quotes, and Excel-style CRLF', () => {
  assert.deepEqual(parseCsv('id,package_name,price\r\n1,"Diamonds, 86",12000\r\n2,"Name ""quoted""",15000\r\n'), [
    { id: '1', package_name: 'Diamonds, 86', price: '12000' },
    { id: '2', package_name: 'Name "quoted"', price: '15000' },
  ]);
});

test('Rupiah validation rejects decimals, negative values and unsafe large values', () => {
  assert.equal(parseRupiah('Rp 12.000'), 12000);
  assert.equal(parseRupiah('12,000'), 12000);
  assert.equal(parseRupiah('-100'), null);
  assert.equal(parseRupiah('10.5'), null);
  assert.equal(parseRupiah('999999999999999999999'), null);
  assert.equal(parseRupiah('100000000'), null);
});

test('CSV export quotes values safely, is Excel-compatible, and neutralizes formula-like text', () => {
  assert.equal(toCsv([{ name: 'A, "B"', price: 100 }], ['name', 'price']), 'name,price\r\n"A, ""B""",100\r\n');
  assert.match(toCsv([{ name: '=HYPERLINK(\"x\")' }], ['name']), /\"'=HYPERLINK\(\"\"x\"\"\)\"/);
});

test('bulk pricing includes preview, explicit confirmation, failure report and CSV import/export', () => {
  for (const text of ['Pratinjau Perubahan Harga', 'Konfirmasi & Simpan', 'setBulkReport', 'Unduh laporan CSV', 'Ekspor CSV / Excel', 'Impor CSV', "supabase.rpc('admin_update_package_pricing'"]) assert.ok(admin.includes(text), `missing ${text}`);
});

test('supplier cost remains private and pricing RPC is guarded without rewriting existing selling prices', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.package_supplier_costs/);
  assert.match(migration, /USING \(public\.is_admin\(\)\)/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.admin_update_package_pricing/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.package_supplier_costs FROM PUBLIC, anon/);
  assert.match(migration, /RAISE EXCEPTION 'Hanya admin\/staf toko yang dapat mengubah harga\.'/);
  assert.doesNotMatch(migration, /GRANT SELECT ON TABLE public\.package_supplier_costs TO anon/);
  assert.match(migration, /SET search_path = pg_catalog, public/);
  assert.match(migration, /p_price <> trunc\(p_price\)/);
});
