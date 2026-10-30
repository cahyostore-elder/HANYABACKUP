import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const sql = read('supabase/audits/20261030_remote_migration_baseline_readonly.sql');
const guide = read('PHASE61_PRODUCTION_MIGRATION_BASELINE.md');
const pkg = JSON.parse(read('package.json'));

test('remote baseline audit is read-only and checks the mixed production state', () => {
  assert.match(sql, /WITH checks AS/);
  assert.match(sql, /supabase_migrations\.schema_migrations/);
  assert.match(sql, /supplier_cost >= 0/);
  assert.match(sql, /private\.is_admin/);
  assert.match(sql, /admin_save_package/);
  assert.match(sql, /admin_update_supplier_cost_and_price/);
  assert.match(sql, /admin_apply_package_pricing_batch/);
  assert.match(sql, /v_price <= 0/);
  assert.match(sql, /v_start_offset/);
  assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE)\s+(TABLE|FUNCTION|POLICY|INDEX|TRIGGER|INTO|SCHEMA)\b/i);
});

test('baseline guide uses schema dump and migration list before repairing history', () => {
  assert.match(guide, /supabase db dump --linked/);
  assert.match(guide, /supabase migration list --linked/);
  assert.match(guide, /migration repair/);
  assert.match(guide, /Do not run `supabase db reset --linked`/);
  assert.match(guide, /Do not run `supabase db push`/);
  assert.match(guide, /Merge commit: `230b5b2b5c63cadcdff2c0604855d0f7fb389437`/);
});

test('Phase 61 audit is in the release chain', () => {
  assert.equal(pkg.scripts['audit:phase61'], 'node --test scripts/phase61-migration-baseline.test.mjs');
  assert.ok(pkg.scripts['audit:release'].includes('audit:phase61'));
});
