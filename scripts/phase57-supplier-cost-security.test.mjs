import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const migration = read('supabase/migrations/20261028050000_phase57_supplier_cost_rpc_security.sql');
const lockdown = read('supabase/migrations/20261028060000_phase57b_supplier_cost_table_lockdown.sql');
const admin = read('src/pages/AdminPage.tsx');
const pkg = JSON.parse(read('package.json'));

function functionBody(name) {
  const match = migration.match(new RegExp(
    'CREATE OR REPLACE FUNCTION public\\.' + name + '\\([\\s\\S]*?AS \\$function\\$([\\s\\S]*?)\\$function\\$;',
    'i',
  ));
  assert.ok(match, 'missing SQL function ' + name);
  return match[1];
}

test('Phase 57A RPC and Phase 57B table lockdown are timestamped after Phase 56 in safe order', () => {
  const files = readdirSync(new URL('../supabase/migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
  assert.ok(files.includes('20261028050000_phase57_supplier_cost_rpc_security.sql'));
  assert.ok(files.includes('20261028060000_phase57b_supplier_cost_table_lockdown.sql'));
  assert.ok(files.indexOf('20261028050000_phase57_supplier_cost_rpc_security.sql') > files.indexOf('20261028040000_phase56_atomic_admin_package_save.sql'));
  assert.ok(files.indexOf('20261028060000_phase57b_supplier_cost_table_lockdown.sql') > files.indexOf('20261028050000_phase57_supplier_cost_rpc_security.sql'));
  assert.match(migration, /\nBEGIN;/);
  assert.match(migration, /NOTIFY pgrst, 'reload schema'/);
  assert.match(migration, /COMMIT;\s*$/);
  assert.match(lockdown, /\nBEGIN;/);
  assert.match(lockdown, /COMMIT;\s*$/);
});

test('supplier cost table is locked only in Phase 57B after frontend migration', () => {
  assert.match(lockdown, /ALTER TABLE public\.package_supplier_costs ENABLE ROW LEVEL SECURITY/);
  assert.match(lockdown, /REVOKE ALL ON TABLE public\.package_supplier_costs\s+FROM PUBLIC, anon, authenticated/);
  assert.match(lockdown, /GRANT SELECT, INSERT, UPDATE, DELETE[\s\S]*TO service_role/);
  assert.match(lockdown, /DROP POLICY IF EXISTS staff_manage_package_supplier_costs/);
  assert.doesNotMatch(migration, /REVOKE ALL ON TABLE public\.package_supplier_costs/);
  assert.doesNotMatch(admin, /\.from\(['"]package_supplier_costs['"]\)/);
  assert.match(admin, /supabase\.rpc\('admin_list_package_supplier_costs'\)/);
});

test('supplier cost list RPC is security-definer, admin-gated and returns audit fields', () => {
  const body = functionBody('admin_list_package_supplier_costs');
  assert.match(migration, /RETURNS TABLE \([\s\S]*?updated_by uuid/);
  assert.match(migration, /FUNCTION public\.admin_list_package_supplier_costs\(\)[\s\S]*?STABLE[\s\S]*?SECURITY DEFINER[\s\S]*?SET search_path = pg_catalog/);
  assert.match(body, /auth\.uid\(\) IS NULL OR NOT public\.is_admin\(\)/);
  assert.match(body, /FROM public\.package_supplier_costs/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.admin_list_package_supplier_costs\(\) FROM PUBLIC, anon/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.admin_list_package_supplier_costs\(\) TO authenticated/);
});

test('modal-only RPC writes supplier_cost and audit identity but never updates selling price', () => {
  const body = functionBody('admin_upsert_package_supplier_cost');
  assert.match(body, /auth\.uid\(\) IS NULL OR NOT public\.is_admin\(\)/);
  assert.match(body, /p_supplier_cost <> trunc\(p_supplier_cost\)/);
  assert.match(body, /INSERT INTO public\.package_supplier_costs/);
  assert.match(body, /updated_by = auth\.uid\(\)/);
  assert.doesNotMatch(body, /UPDATE\s+public\.packages/i);
  assert.doesNotMatch(body, /SET\s+price\s*=/i);
  const uiAction = admin.slice(admin.indexOf('const saveSupplierCostOnly'), admin.indexOf('const save = async () =>', admin.indexOf('const saveSupplierCostOnly')));
  assert.match(uiAction, /supabase\.rpc\('admin_upsert_package_supplier_cost'/);
  assert.match(uiAction, /p_package_id: packageId/);
  assert.match(uiAction, /p_supplier_cost: supplierCost/);
  assert.doesNotMatch(uiAction, /p_price|public\.packages|set\(\{[^}]*price/);
  assert.match(admin, /Simpan Modal Saja — Harga Jual Tetap/);
});

test('atomic package save and bulk pricing record the admin who supplied a modal', () => {
  const bulkBody = functionBody('admin_update_package_pricing');
  const saveBody = functionBody('admin_save_package');
  for (const body of [bulkBody, saveBody]) {
    assert.match(body, /auth\.uid\(\) IS NULL OR NOT public\.is_admin\(\)/);
    assert.match(body, /updated_by = auth\.uid\(\)/);
  }
  assert.match(admin, /supabase\.rpc\('admin_update_package_pricing'/);
  assert.match(admin, /supabase\.rpc\('admin_save_package'/);
});

test('unknown supplier cost remains blank, not zero or copied from the selling price', () => {
  assert.match(admin, /Number\(row\.supplier_cost\)/);
  assert.match(admin, /supplierCosts\[p\.id\] \?\? ''/);
  assert.match(admin, /supplierCostInput === '' \? null : parseRupiah\(supplierCostInput\)/);
  assert.match(admin, /supplierCosts\[p\.id\] \?\? null/);
  assert.match(admin, /supplierCost: supplierCosts\[existing\.id\] \?\? null/);
  assert.match(admin, /supplierCost === null \? 'Belum diisi'/);
  const saveBody = functionBody('admin_save_package');
  assert.match(saveBody, /IF p_supplier_cost IS NOT NULL THEN/);
  assert.match(migration, /IF p_supplier_cost IS NOT NULL THEN/);
  assert.match(migration, /RETURN QUERY SELECT v_package_id, p_price, v_supplier_cost/);
});


test('Phase 57 audit runs in both focused and full release commands', () => {
  assert.equal(pkg.scripts['audit:phase57'], 'node --test scripts/phase57-supplier-cost-security.test.mjs');
  assert.match(pkg.scripts['audit:release'], /audit:phase57/);
});

test('catalog displays an unknown supplier cost as not recorded, never Rp0', () => {
  assert.ok(admin.includes("{supplierCosts[p.id] == null ? 'Modal belum diisi' : `Modal ${formatPrice(Number(supplierCosts[p.id]))}"));
  assert.ok(!admin.includes('Number(supplierCosts[p.id] ?? 0)'));
});

test('shared admin role helper pins search_path and schema-qualifies the profile table', () => {
  const body = functionBody('is_admin');
  assert.ok(migration.includes('CREATE SCHEMA IF NOT EXISTS private'));
  assert.ok(migration.includes('CREATE OR REPLACE FUNCTION private.is_admin()'));
  assert.ok(migration.includes('SECURITY DEFINER\nSET search_path = pg_catalog'));
  assert.ok(migration.includes('REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC, anon'));
  assert.ok(migration.includes('GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated, service_role'));
  assert.ok(migration.includes('SECURITY INVOKER\nSET search_path = pg_catalog'));
  assert.ok(body.includes('SELECT private.is_admin()'));
  assert.ok(migration.includes('REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon'));
  assert.ok(migration.includes('GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated'));
  assert.ok(migration.includes('CHECK (supplier_cost >= 0)'));
});

test('blank modal input preserves an existing package cost without a false mismatch alert', () => {
  assert.ok(admin.includes('const expectedSavedSupplierCost = supplierCost ?? (editing.id ? supplierCosts[editing.id] ?? null : null);'));
  assert.ok(admin.includes('(saved.saved_supplier_cost == null ? null : Number(saved.saved_supplier_cost)) !== expectedSavedSupplierCost'));
  assert.ok(admin.includes('Paket lama: kosong mempertahankan modal tersimpan.'));
});
