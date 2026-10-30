import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const report = read('PHASE64_PRODUCTION_MIGRATION_RECONCILIATION.md');
const audit = read('supabase/audits/20261030_phase64_old_migration_reconciliation_readonly.sql');
const pkg = JSON.parse(read('package.json'));

test('Phase 64 documents the empty remote ledger and reconciles the 19 legacy migrations', () => {
  assert.match(report, /schema_migrations.*absent/i);
  assert.match(report, /Files 1–19 below predate Phase 52/i);
  assert.match(report, /Phase 39.*258/i);
  assert.match(report, /253 exact brand\/name matches/i);
  assert.match(report, /Phase 40.*11 Roblox/i);
});

test('Phase 64 report records production drift and forbids unsafe replay', () => {
  assert.match(report, /RLS enabled on all 11/i);
  assert.match(report, /idx_orders_pending_amount/);
  assert.match(report, /rls_auto_enable\(\)/);
  assert.match(report, /Do not run `supabase db push`/);
  assert.match(report, /Do not replay Phase 39\/40 catalog SQL/);
});

test('companion production audit contains only read-only SELECT statements', () => {
  const executable = audit
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  assert.match(executable, /^\s*SELECT\b/im);
  assert.doesNotMatch(executable, /^\s*(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|GRANT|REVOKE|TRUNCATE|DO)\b/im);
  assert.match(audit, /to_regclass\('supabase_migrations\.schema_migrations'\)/);
  assert.match(audit, /storage\.buckets/);
  assert.match(audit, /pg_policies/);
});

test('Phase 64 reconciliation test is part of the full release audit', () => {
  assert.equal(pkg.scripts['audit:phase64'], 'node --test scripts/phase64-production-reconciliation.test.mjs');
  assert.ok(pkg.scripts['audit:release'].includes('audit:phase64'));
});
