import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const migrationName = '20261027000000_order_creation_idempotency.sql';
const migration = read(`supabase/migrations/${migrationName}`);
const checkout = read('src/pages/TopupPage.tsx');

test('idempotency migration stores request keys and enforces per-user uniqueness', () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS client_request_id uuid/i);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_user_client_request_id[\s\S]*ON public\.orders\s*\(user_id, client_request_id\)[\s\S]*WHERE client_request_id IS NOT NULL/i);
});

test('checkout RPC requires the request key and replaces the legacy signature', () => {
  assert.match(migration, /DROP FUNCTION IF EXISTS public\.create_topup_order\(uuid, uuid, uuid, text, text, text\)/i);
  assert.match(migration, /p_request_id uuid/i);
  assert.match(migration, /IF p_request_id IS NULL THEN[\s\S]*RAISE EXCEPTION/i);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.create_topup_order\(uuid, uuid, uuid, text, text, text, uuid\)[\s\S]*FROM PUBLIC, anon/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.create_topup_order\(uuid, uuid, uuid, text, text, text, uuid\)[\s\S]*TO authenticated/i);
});

test('same request key returns matching existing order and rejects mismatched payloads', () => {
  assert.match(migration, /pg_advisory_xact_lock\(hashtext\(v_user_id::text\), hashtext\(p_request_id::text\)\)/i);
  assert.match(migration, /o\.user_id = v_user_id AND o\.client_request_id = p_request_id/i);
  assert.match(migration, /v_existing\.category_id IS DISTINCT FROM p_category_id/i);
  assert.match(migration, /v_existing\.payment_method IS DISTINCT FROM p_payment_method/i);
  assert.match(migration, /RETURN QUERY[\s\S]*FROM public\.orders o WHERE o\.id = v_existing\.id/i);
});

test('new order persists its idempotency key and authoritative total', () => {
  assert.match(migration, /total_amount, unique_code, status, client_request_id/i);
  assert.match(migration, /v_price \+ 500 \+ v_unique_code, v_unique_code, 'pending', p_request_id/i);
  assert.match(migration, /SET search_path = pg_catalog, public/i);
});

test('checkout reuses one key for the same payload across network retries', () => {
  assert.match(checkout, /requestIdRef = useRef/);
  assert.match(checkout, /requestFingerprint = JSON\.stringify/);
  assert.match(checkout, /existingRequest && existingRequest\.fingerprint === requestFingerprint/);
  assert.match(checkout, /p_request_id:\s*idempotencyRequest\.id/);
  assert.match(checkout, /window\.sessionStorage\.getItem\(storageKey\)/);
  assert.match(checkout, /window\.sessionStorage\.setItem\(storageKey, requestId\)/);
  assert.match(checkout, /clearStoredOrderRequestId\(idempotencyRequest\.storageKey\)/);
});

test('checkout never substitutes an estimated price when the server total is missing', () => {
  assert.match(checkout, /const returnedTotal = Number\(order\?\.total_amount\)/);
  assert.match(checkout, /!Number\.isFinite\(returnedTotal\) \|\| returnedTotal <= 0/);
  assert.match(checkout, /totalAmount: returnedTotal/);
  assert.doesNotMatch(checkout, /totalAmount:\s*Number\(order\.total_amount \?\? grandTotal\)/);
});

test('release audit and live migration guide include Phase 33', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts['audit:phase33'], /phase33-order-idempotency\.test\.mjs/);
  assert.match(pkg.scripts['audit:release'], /npm run audit:phase33/);
  const docs = read('PHASE33_ORDER_RETRY_SAFETY.md').toLowerCase();
  for (const phrase of ['apply this migration before deploying the updated frontend', 'same key', 'controlled test order', 'rollback', 'payment verification and top-up fulfillment remain manual']) {
    assert.ok(docs.includes(phrase), `missing Phase 33 instruction: ${phrase}`);
  }
});

test('all migration filenames remain timestamped and unique', () => {
  const migrations = readdirSync(path.join(root, 'supabase/migrations')).filter((name) => name.endsWith('.sql')).sort();
  assert.equal(new Set(migrations).size, migrations.length);
  for (const name of migrations) assert.match(name, /^\d{14}_[a-z0-9_-]+(?:\.sql)?\.sql$/i, `invalid migration filename: ${name}`);
  assert.ok(migrations.includes(migrationName));
});
