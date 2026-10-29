import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const migration = readFileSync(new URL('../supabase/migrations/20261026040000_lookup_order_search_path_hardening.sql', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('lookup RPC pins search_path and qualifies application tables', () => {
  assert.match(migration, /SECURITY DEFINER/);
  assert.match(migration, /SET search_path = pg_catalog, public/);
  for (const name of ['public.orders', 'public.brands', 'public.packages']) assert.ok(migration.includes(name));
});

test('lookup RPC preserves the expected order-status response contract', () => {
  for (const col of ['o_code text', 'o_status text', 'o_total_amount numeric', 'o_payment_method text', 'o_brand_name text', 'o_package_name text', 'o_target text', 'o_created_at timestamptz']) assert.ok(migration.includes(col));
  assert.match(migration, /WHERE o\.code = lookup_order\.code/);
});

test('lookup RPC grants are explicitly constrained and restored only for intended roles', () => {
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.lookup_order\(text\) FROM PUBLIC, anon/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.lookup_order\(text\) TO anon, authenticated/);
});

test('Phase 21 migration is registered in the release test command', () => {
  assert.equal(pkg.scripts['audit:phase21'], 'node --test scripts/phase21-security-migration.test.mjs');
});
