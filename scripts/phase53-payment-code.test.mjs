import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const sql = read('supabase/migrations/20261028030000_phase54_core_security_and_payment_code_range.sql');
const payment = read('src/lib/payment.ts');
const checkout = read('src/pages/TopupPage.tsx');

test('server enforces configured fees for every enabled payment method', () => {
  for (const rule of ["WHEN 'qris' THEN 300", "WHEN 'seabank' THEN 1000", "WHEN 'dana' THEN 500", "WHEN 'gopay' THEN 500", "WHEN 'ovo' THEN 500", "WHEN 'shopeepay' THEN 500"]) {
    assert.ok(sql.includes(rule), 'missing fee rule: ' + rule);
  }
  assert.match(sql, /v_price \+ v_payment_fee \+ v_unique_code/);
});

test('unique payment code uses the approved inclusive Rp200-Rp999 range and scans candidates without replacement', () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.create_topup_order\(/);
  assert.match(sql, /FOR v_attempt IN 0\.\.799 LOOP/);
  assert.match(sql, /v_unique_code := 200 \+ \(\(v_start_offset \+ v_attempt\) % 800\)/);
  assert.match(sql, /IF NOT v_code_found THEN/);
  assert.match(sql, /pg_advisory_xact_lock\(hashtext\('fityorastore-order-unique-code'\)\)/);
  assert.match(sql, /o\.total_amount = v_price \+ v_payment_fee \+ v_unique_code/);
  assert.doesNotMatch(sql, /floor\(random\(\)\s*\*\s*301\)/);
});

test('RPC keeps authentication, idempotency, and server-side price validation', () => {
  assert.match(sql, /IF v_user_id IS NULL THEN/);
  assert.match(sql, /p_request_id uuid/);
  assert.match(sql, /IF p_request_id IS NULL THEN/);
  assert.match(sql, /SELECT p\.price INTO v_price[\s\S]*FROM public\.packages p/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.create_topup_order[\s\S]*FROM PUBLIC, anon/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.create_topup_order[\s\S]*TO authenticated/);
});

test('checkout displays method-specific fees and the server-generated unique code', () => {
  assert.match(payment, /export function paymentFeeForMethod/);
  assert.match(checkout, /paymentFeeForMethod\(selectedMethod\)/);
  assert.match(checkout, /Ditentukan setelah dibuat/);
});
