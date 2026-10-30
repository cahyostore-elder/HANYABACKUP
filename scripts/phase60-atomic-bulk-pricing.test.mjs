import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const sql = read('supabase/migrations/20261030030000_phase60_atomic_bulk_pricing.sql');
const admin = read('src/pages/AdminPage.tsx');
const pkg = JSON.parse(read('package.json'));

test('bulk pricing is a single authenticated admin RPC with bounded payload size', () => {
  assert.ok(sql.includes('FUNCTION public.admin_apply_package_pricing_batch(p_items jsonb)'));
  assert.ok(sql.includes('SECURITY DEFINER'));
  assert.ok(sql.includes('auth.uid() IS NULL OR NOT public.is_admin()'));
  assert.ok(sql.includes('jsonb_array_length(p_items) > 2000'));
  assert.ok(sql.includes('REVOKE ALL ON FUNCTION public.admin_apply_package_pricing_batch(jsonb) FROM PUBLIC, anon'));
  assert.ok(sql.includes('GRANT EXECUTE ON FUNCTION public.admin_apply_package_pricing_batch(jsonb) TO authenticated'));
  assert.ok(admin.includes("supabase.rpc('admin_apply_package_pricing_batch'"));
  assert.ok(!admin.includes("supabase.rpc('admin_update_package_pricing', { p_package_id: item.id"));
});

test('batch validates IDs, duplicate rows, integer rupiah values, and optional supplier cost zero', () => {
  for (const token of ["v_item ? 'id'", "v_item ? 'price'", 'v_package_id = ANY(v_seen_ids)', 'v_price <> trunc(v_price)', 'v_supplier_cost < 0', 'v_supplier_cost <> trunc(v_supplier_cost)', "jsonb_typeof(v_item->'supplier_cost') <> 'number'"]) assert.ok(sql.includes(token));
});

test('batch locks rows, updates supplier cost and sale price together, and writes audit rows', () => {
  assert.ok(sql.includes('FOR UPDATE'));
  assert.ok(sql.includes('INSERT INTO public.package_supplier_costs'));
  assert.ok(sql.includes('UPDATE public.packages AS p SET price = v_price'));
  assert.ok(sql.includes('INSERT INTO public.package_pricing_audit'));
  assert.ok(sql.includes('v_old_price IS DISTINCT FROM v_price'));
  assert.ok(sql.includes('RETURN NEXT;'));
  assert.ok(sql.includes('BEGIN;') && sql.includes('COMMIT;'));
});

test('Author preview and confirmation occur before batch submission', () => {
  assert.ok(admin.includes('Seluruh baris valid akan disimpan dalam satu transaksi'));
  assert.ok(admin.includes('window.confirm('));
  assert.ok(admin.includes('new Map<string, SavedBulkRow>(savedRows.map((row) => [row.package_id, row]))'));
  assert.ok(admin.includes('status: \'Gagal\''));
});

test('Phase 60 is registered in the release audit', () => {
  assert.equal(pkg.scripts['audit:phase60'], 'node --test scripts/phase60-atomic-bulk-pricing.test.mjs');
  assert.ok(pkg.scripts['audit:release'].includes('audit:phase60'));
});
