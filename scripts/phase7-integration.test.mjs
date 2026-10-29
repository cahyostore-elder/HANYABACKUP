import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));

const admin = read('src/pages/AdminPage.tsx');
const topup = read('src/pages/TopupPage.tsx');
const statusPage = read('src/pages/OrderStatusPage.tsx');
const auth = read('src/context/AuthContext.tsx');
const sql = read('supabase/migrations/20261026030000_manual_order_workflow_hardening.sql');
const lookupSql = read('supabase/migrations/20261025220738_fityora_content_and_lookup.sql.sql');
const client = read('src/lib/supabase.ts');
const pkg = JSON.parse(read('package.json'));
const env = read('.env.example');
const vercel = JSON.parse(read('vercel.json'));

test('Admin screen waits for auth bootstrap before rendering admin data', () => {
  assert.match(admin, /loading:\s*authLoading/);
  assert.match(admin, /if\s*\(authLoading\)\s*\{/);
  assert.match(admin, /Memeriksa sesi dan hak akses/);
});

test('Admin access fails closed when profile is missing or role is not staff', () => {
  assert.match(admin, /if\s*\(!session\s*\|\|\s*!profile\s*\|\|\s*\(profile\.role !== 'admin' && profile\.role !== 'author'\)\)/);
  assert.match(admin, /if\s*\(!profile\)\s*\{/);
  assert.match(admin, /if\s*\(profile\.role !== 'admin' && profile\.role !== 'author'\)\s*\{/);
  assert.doesNotMatch(admin, /if\s*\(profile\s*&&\s*profile\.role !==/);
});

test('Admin data loading is gated by valid authenticated staff profile', () => {
  const effect = admin.slice(admin.indexOf('useEffect(() => {'), admin.indexOf('\n\n  if (authLoading)'));
  assert.ok(effect.indexOf("profile.role !== 'admin'") >= 0);
  assert.ok(effect.indexOf('void loadAll()') > effect.indexOf("profile.role !== 'author'"));
});

test('Admin order updates go through a guarded server RPC', () => {
  assert.match(admin, /supabase\.rpc\('admin_update_order_status'/);
  assert.match(sql, /auth\.uid\(\) IS NULL OR NOT public\.is_admin\(\)/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.admin_update_order_status\(uuid, text\) FROM PUBLIC, anon/);
});

test('Order status RPC only permits intentional transitions and protects final states', () => {
  assert.match(sql, /v_order\.status = 'pending' AND p_status = 'success'/);
  assert.match(sql, /v_order\.status = 'processing' AND p_status = 'pending'/);
  assert.match(sql, /v_order\.status IN \('success', 'failed'\)/);
  assert.match(sql, /payment_verified_at = now\(\)/);
  assert.match(sql, /fulfillment_completed_at = now\(\)/);
});

test('Checkout uses the database RPC and displays the server-returned total', () => {
  assert.match(topup, /supabase\.rpc\('create_topup_order'/);
  assert.match(topup, /const returnedTotal = Number\(order\?\.total_amount\)/);
  assert.match(topup, /totalAmount:\s*returnedTotal/);
  assert.match(topup, /finally\s*\{\s*setPlacing\(false\);/);
});

test('Checkout handles invalid or unavailable payment methods before creating an order', () => {
  assert.match(topup, /if\s*\(!method\s*\|\|\s*method\.maintenance\)/);
  assert.match(sql, /p_payment_method NOT IN/);
});

test('Checkout database validates category-brand-package relationships and derives price server-side', () => {
  assert.match(sql, /v_actual_category IS DISTINCT FROM p_category_id/);
  assert.match(sql, /WHERE p\.id = p_package_id AND p\.brand_id = p_brand_id/);
  assert.match(sql, /SELECT p\.price INTO v_price/);
  assert.match(sql, /v_price \+ 500 \+ v_unique_code/);
});

test('Checkout code allocation avoids active duplicate payment totals', () => {
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /o\.status IN \('pending', 'processing'\)/);
  assert.match(sql, /v_attempt >= 900/);
});

test('Public order status page uses the scoped lookup RPC and displays errors', () => {
  assert.match(statusPage, /supabase\.rpc\('lookup_order'/);
  assert.match(statusPage, /kind:\s*'error'/);
  assert.match(statusPage, /role="alert"/);
});

test('Public order lookup does not return user id or email fields', () => {
  const returns = lookupSql.slice(lookupSql.indexOf('CREATE OR REPLACE FUNCTION lookup_order'), lookupSql.indexOf('LANGUAGE plpgsql', lookupSql.indexOf('CREATE OR REPLACE FUNCTION lookup_order')));
  assert.doesNotMatch(returns, /user_id|email/i);
  assert.match(returns, /o_target text/);
});

test('Catalog load errors are surfaced with a retry action', () => {
  assert.match(topup, /error:\s*categoryError/);
  assert.match(topup, /error:\s*brandsError/);
  assert.match(topup, /setCatalogError\('Kategori gagal dimuat/);
  assert.match(topup, /setCatalogAttempt\(\(attempt\) => attempt \+ 1\)/);
});

test('Package fetching ignores stale responses and supports retry/error states', () => {
  assert.match(topup, /let active = true;/);
  assert.match(topup, /if\s*\(!active\) return;/);
  assert.match(topup, /setPackageError\('Nominal gagal dimuat/);
  assert.match(topup, /setPackageRetry\(\(attempt\) => attempt \+ 1\)/);
  assert.match(topup, /\[selectedBrand, packageRetry\]/);
});

test('Changing brand clears stale selected package and target fields', () => {
  const selectBrand = topup.slice(topup.indexOf('const selectBrand'), topup.indexOf('\n\n  const filteredBrands'));
  assert.match(selectBrand, /setSelectedPackage\(null\)/);
  assert.match(selectBrand, /setTarget\(''\)/);
  assert.match(selectBrand, /setServer\(''\)/);
});

test('Auth profile requests are guarded against stale account responses', () => {
  assert.match(auth, /requestId !== profileRequestId\.current/);
  assert.ok(auth.indexOf('supabase.auth.onAuthStateChange') < auth.indexOf('supabase.auth.getSession()'));
});

test('Frontend config does not contain a service-role secret', () => {
  assert.doesNotMatch(client, /service_role|sb_secret_[A-Za-z0-9_-]{10,}/i);
  assert.doesNotMatch(env, /service_role|sb_secret_[A-Za-z0-9_-]{10,}/i);
});

test('Vercel SPA rewrite and build scripts are configured', () => {
  assert.ok(vercel.rewrites?.some((rule) => rule.destination === '/index.html'));
  assert.equal(typeof pkg.scripts?.build, 'string');
  assert.equal(typeof pkg.scripts?.typecheck, 'string');
  assert.equal(pkg.scripts?.['audit:phase7'], 'node --test scripts/phase7-integration.test.mjs');
});

test('Critical source, lockfile and migration files exist', () => {
  for (const file of [
    'package-lock.json', 'src/App.tsx', 'src/pages/TopupPage.tsx',
    'src/pages/AdminPage.tsx', 'src/pages/OrderStatusPage.tsx',
    'supabase/migrations/20261026030000_manual_order_workflow_hardening.sql',
  ]) assert.equal(exists(file), true, `${file} should exist`);
});
