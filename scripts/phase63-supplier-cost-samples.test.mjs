import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const migration = read('supabase/migrations/20261030050000_phase63_sample_supplier_costs.sql');
const admin = read('src/pages/AdminPage.tsx');
const pkg = JSON.parse(read('package.json'));

test('Phase 63 distinguishes supplier-cost samples from Author-verified supplier prices', () => {
  assert.match(migration, /supplier_cost_status text NOT NULL DEFAULT 'verified'/);
  assert.match(migration, /CHECK \(supplier_cost_status IN \('sample', 'verified'\)\)/);
  assert.match(migration, /supplier_cost_source/);
  assert.match(migration, /CHECK \(supplier_cost >= 0\)/);
  assert.match(migration, /'sample'/);
  assert.match(migration, /'verified'/);
});

test('sample seeding does not change selling prices and leaves an explicit placeholder for zero-priced packages', () => {
  assert.match(migration, /round\(p\.price \/ 1\.07, 0\)/);
  assert.match(migration, /ELSE 0/);
  assert.match(migration, /'placeholder_unpriced_package'/);
  assert.match(migration, /WHERE NOT EXISTS \([\s\S]*?existing\.package_id = p\.id/);
  const seedSection = migration.split('-- Recreate the list RPC with explicit sample/verified status.')[0];
  assert.doesNotMatch(seedSection, /UPDATE public\.packages[\s\S]*?SET price/);
});

test('Author list RPC returns status and manual upsert marks entered costs verified', () => {
  assert.match(migration, /RETURNS TABLE \([\s\S]*?supplier_cost_status text[\s\S]*?supplier_cost_source text/);
  assert.match(migration, /supplier_cost_status = 'verified'/);
  assert.match(migration, /supplier_cost_source = 'author_manual'/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.admin_list_package_supplier_costs\(\) FROM PUBLIC, anon/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.admin_upsert_package_supplier_cost\(uuid, numeric\) TO authenticated/);
});

test('sample costs are excluded from price audit and automatic selling-price recalculation', () => {
  assert.match(migration, /IF v_supplier_status = 'verified' AND v_supplier_cost IS NOT NULL/);
  assert.match(migration, /admin_update_supplier_cost_and_price/);
  assert.match(migration, /v_new_price := round\(p_supplier_cost \* 1\.07, 0\)/);
  assert.match(migration, /supplier_cost_status, supplier_cost_source/);
  assert.match(migration, /'verified', 'author_import'/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\\.admin_preview_package_pricing\\(\\)[\\s\\S]*?FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\\.admin_set_package_supplier_cost\\(uuid, numeric\\)[\\s\\S]*?FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\\.admin_apply_package_pricing\\(uuid\\[\\]\\)[\\s\\S]*?FROM PUBLIC, anon, authenticated/);
});

test('Author dashboard visibly labels sample prices and requires verification for CSV modal imports', () => {
  assert.match(admin, /supplierCostStatuses/);
  assert.match(admin, /CONTOH/);
  assert.match(admin, /belum diverifikasi/);
  assert.match(admin, /requestedCostStatus === 'verified'/);
  assert.match(admin, /requestedCostStatus !== 'sample'/);
  assert.match(admin, /supplier_cost_status menjadi verified/);
  assert.match(admin, /supplier_cost_status: supplierCostStatuses\[p\.id\] \?\? 'missing'/);
  assert.match(admin, /supplier_cost: supplierCostStatuses\[p\.id\] === 'sample' \? ''/);
});

test('Phase 63 regression audit is part of the release chain', () => {
  assert.equal(pkg.scripts['audit:phase63'], 'node --test scripts/phase63-supplier-cost-samples.test.mjs');
  assert.ok(pkg.scripts['audit:release'].includes('audit:phase63'));
});
