import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const migration57 = read('supabase/migrations/20261028050000_phase57_supplier_cost_rpc_security.sql');
const migration58 = read('supabase/migrations/20261030010000_phase58_author_catalog_pricing.sql');
const admin = read('src/pages/AdminPage.tsx');
const pkg = JSON.parse(read('package.json'));

test('supplier cost accepts zero while blank still means not configured', () => {
  assert.ok(migration57.includes('DROP CONSTRAINT IF EXISTS package_supplier_costs_supplier_cost_check'));
  assert.ok(migration57.includes('CHECK (supplier_cost >= 0)'));
  assert.ok(migration57.includes('private.is_admin()'));
  assert.ok(admin.includes('supplierCost === null || supplierCost > 99_999_999'));
  assert.ok(admin.includes("supplierCosts[p.id] == null ? ''"));
});

test('single-product Author action updates supplier cost and sale price atomically after confirmation', () => {
  assert.ok(admin.includes('saveSupplierAndUpdatePrice'));
  assert.ok(admin.includes('admin_update_supplier_cost_and_price'));
  assert.ok(admin.includes('window.confirm('));
  assert.ok(admin.includes('Harga jual baru (modal + 7%)'));
  assert.ok(admin.includes('Simpan Modal + Perbarui Harga Jual (7%)'));
  assert.ok(migration58.includes('CREATE OR REPLACE FUNCTION public.admin_update_supplier_cost_and_price'));
  assert.ok(migration58.includes('round(p_supplier_cost * 1.07, 0)'));
  assert.ok(migration58.includes('INSERT INTO public.package_pricing_audit'));
  assert.ok(migration58.includes('v_old_price IS DISTINCT FROM p_price'));
  assert.ok(migration58.includes('v_old_price IS DISTINCT FROM v_new_price'));
  assert.ok(migration58.includes('REVOKE ALL ON FUNCTION public.admin_update_supplier_cost_and_price(uuid, numeric) FROM PUBLIC, anon'));
  assert.ok(migration58.includes('GRANT EXECUTE ON FUNCTION public.admin_update_supplier_cost_and_price(uuid, numeric) TO authenticated'));
});

test('normal Author package save writes audit when sale price changes and a supplier cost exists', () => {
  assert.ok(migration58.includes('CREATE OR REPLACE FUNCTION public.admin_save_package('));
  assert.ok(migration58.includes('v_old_price IS DISTINCT FROM p_price'));
  assert.ok(migration58.includes('INSERT INTO public.package_pricing_audit (package_id, package_name, supplier_cost, old_price, new_price, margin_percent, applied_by)'));
  assert.ok(migration58.includes('updated_by = auth.uid()'));
  assert.ok(migration58.includes('GRANT EXECUTE ON FUNCTION public.admin_save_package(uuid, uuid, text, text, numeric, integer, boolean, numeric) TO authenticated'));
});

test('supplier-only CSV template supports late bulk entry', () => {
  assert.ok(admin.includes('exportSupplierCsv'));
  assert.ok(admin.includes('fityorastore-template-modal-supplier.csv'));
  assert.ok(admin.includes('Template Modal Supplier'));
  assert.ok(admin.includes("const rawPrice = String(row.price ?? '').trim()"));
  assert.ok(admin.includes("rawPrice === '' && newSupplierCost !== undefined"));
  assert.ok(admin.includes('Math.round(newSupplierCost * 1.07)'));
  assert.ok(migration58.includes('CREATE OR REPLACE FUNCTION public.admin_update_package_pricing'));
});

test('bulk and manual price updates create audit rows and preserve unknown costs', () => {
  assert.ok(migration58.includes('IF p_supplier_cost IS NOT NULL THEN'));
  assert.ok(migration58.includes('IF v_cost IS NOT NULL AND v_old_price IS DISTINCT FROM p_price THEN'));
  assert.ok(migration58.includes('RETURN QUERY SELECT p_package_id, p_price, v_cost'));
  assert.ok(migration58.includes('auth.uid()'));
});

test('Phase 58 follows Phase 57B and is registered in release audit', () => {
  const files = readdirSync(new URL('../supabase/migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
  assert.ok(files.indexOf('20261030010000_phase58_author_catalog_pricing.sql') > files.indexOf('20261028060000_phase57b_supplier_cost_table_lockdown.sql'));
  assert.equal(pkg.scripts['audit:phase58'], 'node --test scripts/phase58-author-catalog-pricing.test.mjs');
  assert.ok(pkg.scripts['audit:release'].includes('audit:phase58'));
});
