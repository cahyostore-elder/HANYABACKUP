import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const exists = (name) => fs.existsSync(path.join(root, name));
const orderSql = read('supabase/migrations/20261026030000_manual_order_workflow_hardening.sql');
const lookupSql = read('supabase/migrations/20261025220738_fityora_content_and_lookup.sql.sql');
const client = read('src/lib/supabase.ts');
const topup = read('src/pages/TopupPage.tsx');
const admin = read('src/pages/AdminPage.tsx');
const status = read('src/pages/OrderStatusPage.tsx');
const pkg = JSON.parse(read('package.json'));

test('SECURITY DEFINER RPCs pin search_path', () => {
  assert.match(orderSql, /CREATE OR REPLACE FUNCTION public\.create_topup_order[\s\S]*?SECURITY DEFINER\s+SET search_path = pg_catalog, public/);
  assert.match(orderSql, /CREATE FUNCTION public\.admin_update_order_status[\s\S]*?SECURITY DEFINER\s+SET search_path = pg_catalog, public/);
});

test('Order RPC execution is revoked from public and anon', () => {
  assert.match(orderSql, /REVOKE ALL ON FUNCTION public\.create_topup_order\(uuid, uuid, uuid, text, text, text\)\s+FROM PUBLIC, anon/);
  assert.match(orderSql, /REVOKE ALL ON FUNCTION public\.admin_update_order_status\(uuid, text\) FROM PUBLIC, anon/);
});

test('Order creation requires an authenticated user and validates target', () => {
  assert.match(orderSql, /IF v_user_id IS NULL THEN/);
  assert.match(orderSql, /length\(trim\(coalesce\(p_target, ''\)\)\) = 0/);
});

test('Order creation checks package belongs to selected brand', () => {
  assert.match(orderSql, /WHERE p\.id = p_package_id AND p\.brand_id = p_brand_id/);
});

test('Payment methods are allowlisted server-side', () => {
  assert.match(orderSql, /p_payment_method NOT IN\s*\('dana', 'gopay', 'ovo', 'shopeepay', 'seabank', 'qris'\)/);
});

test('Order status RPC locks the target row before transition', () => {
  assert.match(orderSql, /SELECT \* INTO v_order FROM public\.orders WHERE id = p_order_id FOR UPDATE/);
});

test('Order lookup function avoids exposing account identifiers', () => {
  const start = lookupSql.indexOf('CREATE OR REPLACE FUNCTION lookup_order');
  assert.notEqual(start, -1, 'lookup_order function exists');
  const end = lookupSql.indexOf('LANGUAGE plpgsql', start);
  const signature = lookupSql.slice(start, end);
  assert.doesNotMatch(signature, /user_id|email/i);
});

test('Client uses public environment variables and no service-role key', () => {
  assert.match(client, /VITE_SUPABASE_URL/);
  assert.match(client, /VITE_SUPABASE_ANON_KEY/);
  assert.doesNotMatch(client, /service_role|sb_secret_[A-Za-z0-9_-]{10,}/i);
});

test('Checkout consumes server-calculated total and always clears pending state', () => {
  assert.match(topup, /supabase\.rpc\('create_topup_order'/);
  assert.match(topup, /const returnedTotal = Number\(order\?\.total_amount\)/);
  assert.match(topup, /totalAmount:\s*returnedTotal/);
  assert.match(topup, /finally\s*\{\s*setPlacing\(false\);/);
});

test('Admin status changes use guarded RPC rather than direct status writes', () => {
  assert.match(admin, /supabase\.rpc\('admin_update_order_status'/);
});

test('Order status lookup displays failures accessibly', () => {
  assert.match(status, /supabase\.rpc\('lookup_order'/);
  assert.match(status, /role="alert"/);
});

test('All regression scripts are registered in package.json', () => {
  assert.equal(pkg.scripts?.['audit:phase7'], 'node --test scripts/phase7-integration.test.mjs');
  assert.equal(pkg.scripts?.['audit:phase8'], 'node --test scripts/phase8-regression.test.mjs');
  assert.equal(exists('package-lock.json'), true);
});
