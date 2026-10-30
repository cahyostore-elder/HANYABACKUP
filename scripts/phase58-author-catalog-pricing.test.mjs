import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const migration57 = read('supabase/migrations/20261028050000_phase57_supplier_cost_rpc_security.sql');
const migration58 = read('supabase/migrations/20261030010000_phase58_author_catalog_pricing.sql');
const admin = read('src/pages/AdminPage.tsx');
const pkg = JSON.parse(read('package.json'));

test('supplier cost accepts zero while blank still means not configured', () => {
  assert.match(migration57, /DROP CONSTRAINT IF EXISTS package_supplier_costs_supplier_cost_check/);
  assert.match(migration57, /CHECK \\(supplier_cost >= 0\\)/);
  assert.match(migration57, /private\\.is_admin\\(\\)/);
  assert.match(admin, /supplierCost === null \\|\\| supplierCost > 99_999_999/);
  assert.match(admin, /supplierCosts\\[p\\.id\\] == null \\? ''/);
});

test('single-product Author action updates supplier cost and sale price atomically after confirmation', () => {
  assert.match(admin, /saveSupplierAndUpdatePrice/);
  assert.match(admin, /admin_update_supplier_cost_and_price/);
  assert.match(admin, /window\\.confirm\\([\\s\\S]*Harga jual baru/);
  assert.match(admin, /Simpan Modal \\+ Perbarui Harga Jual \\(7%\\)/);
  assert.match(migration58, /CREATE OR REPLACE FUNCTION public\\.admin_update_supplier_cost_and_price/);
  assert.match(migration58, /round\\(p_supplier_cost \\* 1\\.07, 0\\)/);
  assert.match(migration58, /INSERT INTO public\\.package_pricing_audit/);
  assert.match(migration58, /REVOKE ALL ON FUNCTION public\\.admin_update_supplier_cost_and_price\\(uuid, numeric\\) FROM PUBLIC, anon/);
  assert.match(migration58, /GRANT EXECUTE ON FUNCTION public\\.admin_update_supplier_cost_and_price\\(uuid, numeric\\) TO authenticated/);
});

test('supplier-only CSV template supports late bulk entry', () => {
  assert.match(admin, /exportSupplierCsv/);
  assert.match(admin, /fityorastore-template-modal-supplier\\.csv/);
  assert.match(admin, /Template Modal Supplier/);
  assert.match(admin, /const rawPrice = String\\(row\\.price \\?\\? ''\\)\\.trim\\(\\)/);
  assert.match(admin, /rawPrice === '' && newSupplierCost !== undefined/);
  assert.match(admin, /Math\\.round\\(newSupplierCost \\* 1\\.07\\)/);
  assert.match(migration58, /CREATE OR REPLACE FUNCTION public\\.admin_update_package_pricing/);
});

test('bulk and manual price updates create audit rows and preserve unknown costs', () => {
  assert.match(migration58, /IF p_supplier_cost IS NOT NULL THEN/);
  assert.match(migration58, /IF v_cost IS NOT NULL THEN/);
  assert.match(migration58, /RETURN QUERY SELECT p_package_id, p_price, v_cost/);
  assert.match(migration58, /auth\\.uid\\(\\)/);
});

test('Phase 58 follows Phase 57B and is registered in release audit', () => {
  const files = readdirSync(new URL('../supabase/migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
  assert.ok(files.indexOf('20261030010000_phase58_author_catalog_pricing.sql') > files.indexOf('20261028060000_phase57b_supplier_cost_table_lockdown.sql'));
  assert.equal(pkg.scripts['audit:phase58'], 'node --test scripts/phase58-author-catalog-pricing.test.mjs');
  assert.match(pkg.scripts['audit:release'], /audit:phase58/);
});
