import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const migrationsDir = path.join(root, 'supabase/migrations');
const migrations = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort();
const migrationText = (name) => read(`supabase/migrations/${name}`);

test('latest order creation RPC enforces login and validates catalog relationships', () => {
  const file = migrations.filter((name) => name.includes('manual_order_workflow_hardening')).at(-1);
  assert.ok(file, 'manual order workflow migration missing');
  const sql = migrationText(file);
  assert.match(sql, /v_user_id\s+uuid\s*:=\s*auth\.uid\(\)/i);
  assert.match(sql, /IF\s+v_user_id\s+IS\s+NULL/i);
  assert.match(sql, /v_actual_category\s+IS\s+DISTINCT\s+FROM\s+p_category_id/i);
  assert.match(sql, /p\.brand_id\s*=\s*p_brand_id/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.create_topup_order[\s\S]*FROM PUBLIC, anon/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.create_topup_order[\s\S]*TO authenticated/i);
});

test('admin order status RPC checks admin role and blocks unsafe transitions', () => {
  const file = migrations.filter((name) => name.includes('manual_order_workflow_hardening')).at(-1);
  const sql = migrationText(file);
  assert.match(sql, /auth\.uid\(\) IS NULL OR NOT public\.is_admin\(\)/i);
  assert.match(sql, /v_order\.status IN \('success', 'failed'\)/i);
  assert.match(sql, /v_order\.status = 'pending' AND p_status = 'success'/i);
  assert.match(sql, /FOR UPDATE/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.admin_update_order_status[\s\S]*FROM PUBLIC, anon/i);
});

test('public order lookup exposes only limited status fields and uses fixed search path', () => {
  const file = migrations.filter((name) => name.includes('lookup_order_search_path_hardening')).at(-1);
  assert.ok(file, 'lookup hardening migration missing');
  const sql = migrationText(file);
  assert.match(sql, /SECURITY DEFINER/i);
  assert.match(sql, /SET search_path = pg_catalog, public/i);
  assert.match(sql, /RETURNS TABLE\s*\([\s\S]*o_code[\s\S]*o_status[\s\S]*o_total_amount/i);
  assert.doesNotMatch(sql, /RETURNS TABLE\s*\([\s\S]{0,500}\buser_id\b/i);
  assert.match(sql, /WHERE o\.code = lookup_order\.code/i);
  assert.match(sql, /LIMIT 1/i);
});

test('all migration filenames are timestamped and unique', () => {
  assert.ok(migrations.length > 0);
  assert.equal(new Set(migrations).size, migrations.length);
  for (const name of migrations) assert.match(name, /^\d{14}_[a-z0-9_-]+(?:\.sql)?\.sql$/i, `invalid migration filename: ${name}`);
  // Preserve legacy migration filenames to avoid changing Supabase migration history.
  assert.ok(migrations.some((name) => name.endsWith('.sql.sql')), 'expected legacy double-extension migration to be documented');
});

test('frontend Supabase client never uses service-role or secret-key variables', () => {
  const source = read('src/lib/supabase.ts');
  assert.match(source, /VITE_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(source, /VITE_SUPABASE_ANON_KEY/);
  assert.doesNotMatch(source, /VITE_SUPABASE_SERVICE_ROLE_KEY|VITE_SUPABASE_SECRET_KEY|sb_secret_/i);
});

test('Vercel environment guide separates public browser keys from server secrets', () => {
  const docs = `${read('README.md')}\n${read('PHASE30_PRODUCTION_HARDENING.md')}\n${read('PHASE31_COMMERCE_SAFETY.md')}`.toLowerCase();
  assert.match(docs, /service_role/);
  assert.match(docs, /vercel/);
  assert.match(docs, /preview/);
});

test('release audit includes the Phase 32 checks', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts['audit:phase32'], /node --test scripts\/phase32-live-verification\.test\.mjs/);
  assert.match(pkg.scripts['audit:release'], /npm run audit:phase32/);
});

test('production checklist requires live customer/admin and order lifecycle verification', () => {
  const docs = read('PHASE32_LIVE_VERIFICATION.md').toLowerCase();
  for (const phrase of ['normal customer account', 'admin account', 'double-click', 'payment recipient', 'rollback', 'not proof of live integration']) {
    assert.ok(docs.includes(phrase), `missing live verification instruction: ${phrase}`);
  }
});
