import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(path.join(root, f), 'utf8');
const sql = read('supabase/migrations/20261028030000_phase54_core_security_and_payment_code_range.sql');
const audit = read('supabase/PHASE54_READONLY_SECURITY_AUDIT.sql');

test('Phase 54 uses inclusive random unique-code range Rp200-Rp500', () => {
  assert.match(sql, /floor\(random\(\) \* 301\)::integer \+ 200/);
  assert.match(sql, /v_price \+ v_payment_fee \+ v_unique_code/);
});

test('order creation remains authenticated and idempotent', () => {
  assert.match(sql, /IF v_user_id IS NULL THEN/);
  assert.match(sql, /p_request_id uuid/);
  assert.match(sql, /pg_advisory_xact_lock\(hashtext\(v_user_id::text\), hashtext\(p_request_id::text\)\)/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.create_topup_order[\s\S]*FROM PUBLIC, anon/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.create_topup_order[\s\S]*TO authenticated/);
});

test('fees remain server-side and supported methods are allow-listed', () => {
  for (const rule of ["WHEN 'qris' THEN 300", "WHEN 'seabank' THEN 1000", "WHEN 'dana' THEN 500", "WHEN 'gopay' THEN 500", "WHEN 'ovo' THEN 500", "WHEN 'shopeepay' THEN 500"]) assert.ok(sql.includes(rule), `missing fee rule: ${rule}`);
  assert.match(sql, /p_payment_method NOT IN/);
});

test('security audit is read-only and covers RLS, policies, definer functions, and RPC grants', () => {
  assert.match(audit, /relrowsecurity/);
  assert.match(audit, /FROM pg_policies/);
  assert.match(audit, /p\.prosecdef/);
  assert.match(audit, /information_schema\.routine_privileges/);
  assert.doesNotMatch(audit, /\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE)\s+(TABLE|FUNCTION|POLICY|INDEX|TRIGGER|INTO)\b/i);
});
