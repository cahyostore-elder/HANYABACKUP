import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const migration = read('supabase/migrations/20261027000000_order_creation_idempotency.sql');
const diagnostics = read('supabase/PHASE36_READONLY_ORDER_DIAGNOSTICS.sql');
const checkout = read('src/pages/TopupPage.tsx');
const pkg = JSON.parse(read('package.json'));

test('Phase 36 diagnostic SQL is read-only and uses catalog inspection only', () => {
  assert.match(diagnostics, /SELECT/i);
  assert.match(diagnostics, /information_schema\.columns/i);
  assert.match(diagnostics, /pg_proc/i);
  assert.doesNotMatch(diagnostics.replace(/^\s*--.*$/gm, ''), /\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|GRANT|REVOKE)\b/i);
});

test('idempotency migration adds a nullable request key and partial unique index without rewriting old orders', () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS client_request_id uuid/i);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_user_client_request_id/i);
  assert.match(migration, /WHERE client_request_id IS NOT NULL/i);
  assert.doesNotMatch(migration, /\b(DROP TABLE|TRUNCATE|DELETE FROM public\.orders)\b/i);
});

test('frontend RPC arguments exactly include the required idempotency key', () => {
  for (const key of ['p_category_id', 'p_brand_id', 'p_package_id', 'p_target', 'p_server', 'p_payment_method', 'p_request_id']) {
    assert.match(checkout, new RegExp(`${key}\\s*:`), `missing frontend RPC argument ${key}`);
    assert.match(migration, new RegExp(`${key}\\s+[^,\\n]+`, 'i'), `missing SQL RPC parameter ${key}`);
  }
});

test('order RPC pins search_path and restricts execution to authenticated users', () => {
  assert.match(migration, /SECURITY DEFINER[\s\S]*SET search_path = pg_catalog, public/i);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.create_topup_order[\s\S]*FROM PUBLIC, anon/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.create_topup_order[\s\S]*TO authenticated/i);
});

test('order RPC checks ownership from auth.uid and validates client request reuse payload', () => {
  assert.match(migration, /v_user_id uuid := auth\.uid\(\)/i);
  assert.match(migration, /IF v_user_id IS NULL THEN/i);
  assert.match(migration, /o\.client_request_id\s*=\s*p_request_id/i);
  assert.match(migration, /Kunci permintaan sudah digunakan untuk data pesanan berbeda/i);
});

test('migration verifies catalog and package relationship and derives price from database', () => {
  assert.match(migration, /v_actual_category IS DISTINCT FROM p_category_id/i);
  assert.match(migration, /p\.id = p_package_id AND p\.brand_id = p_brand_id/i);
  assert.match(migration, /SELECT p\.price INTO v_price/i);
  assert.doesNotMatch(checkout, /total_amount\s*:\s*[^,}]+/i);
});

test('diagnostic SQL checks function grants, request column, and unique index presence', () => {
  for (const phrase of ['client_request_id', 'idx_orders_user_client_request_id', 'create_topup_order', 'has_function_privilege']) {
    assert.ok(diagnostics.toLowerCase().includes(phrase.toLowerCase()), `diagnostic missing ${phrase}`);
  }
});

test('release audit includes Phase 36 without adding a runtime dependency', () => {
  assert.match(pkg.scripts['audit:phase36'] ?? '', /phase36-supabase-verification\.test\.mjs/);
  assert.match(pkg.scripts['audit:release'], /npm run audit:phase36/);
  assert.equal(pkg.dependencies?.['pg'], undefined);
  assert.equal(pkg.dependencies?.['@supabase/supabase-js'], '^2.57.4');
  const migrations = readdirSync(path.join(root, 'supabase/migrations')).filter((name) => name.endsWith('.sql'));
  assert.equal(new Set(migrations).size, migrations.length);
});
