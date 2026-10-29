import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const migration = read('supabase/migrations/20261027000000_order_creation_idempotency.sql');
const guide = read('PHASE33_ORDER_RETRY_SAFETY.md').toLowerCase();
const pkg = JSON.parse(read('package.json'));

test('Phase 34 keeps checkout RPC parameter names aligned between frontend and SQL', () => {
  const checkout = read('src/pages/TopupPage.tsx');
  for (const key of ['p_category_id', 'p_brand_id', 'p_package_id', 'p_target', 'p_server', 'p_payment_method', 'p_request_id']) {
    assert.match(checkout, new RegExp(`${key}\\s*:`), `frontend RPC argument missing: ${key}`);
    assert.match(migration, new RegExp(`${key}\\s+[^,\\n]+`, 'i'), `SQL RPC parameter missing: ${key}`);
  }
});

test('idempotency migration preserves old orders and adds only nullable request key plus partial uniqueness', () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS client_request_id uuid/i);
  assert.match(migration, /WHERE client_request_id IS NOT NULL/i);
  assert.doesNotMatch(migration, /DROP TABLE|TRUNCATE|DELETE FROM public\.orders/i);
});

test('security-definer order RPC checks authentication, pins search_path, and restricts execute grants', () => {
  assert.match(migration, /SECURITY DEFINER[\s\S]*SET search_path = pg_catalog, public/i);
  assert.match(migration, /IF v_user_id IS NULL THEN/i);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.create_topup_order[\s\S]*FROM PUBLIC, anon/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.create_topup_order[\s\S]*TO authenticated/i);
});

test('production guide requires migration-first rollout and manual payment verification disclosure', () => {
  assert.ok(guide.includes('apply this migration before deploying the updated frontend'));
  assert.ok(guide.includes('controlled test order'));
  assert.ok(guide.includes('payment verification and top-up fulfillment remain manual'));
});

test('release checks include Phase 34 without adding a runtime dependency', () => {
  assert.match(pkg.scripts['audit:phase34'], /phase34-integration-readiness\.test\.mjs/);
  assert.match(pkg.scripts['audit:release'], /npm run audit:phase34/);
  assert.equal(pkg.dependencies?.['pg'], undefined);
  assert.equal(pkg.dependencies?.['@supabase/supabase-js'], '^2.57.4');
});

test('migration filenames are unique and timestamped', () => {
  const migrations = readdirSync(path.join(root, 'supabase/migrations')).filter((name) => name.endsWith('.sql')).sort();
  assert.equal(new Set(migrations).size, migrations.length);
  for (const name of migrations) assert.match(name, /^\d{14}_[a-z0-9_-]+(?:\.sql)?\.sql$/i, name);
});
