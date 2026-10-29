import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const checkout = read('src/pages/TopupPage.tsx');
const admin = read('src/pages/AdminPage.tsx');
const migration = read('supabase/migrations/20261027010000_manual_payment_proofs.sql');
const pkg = JSON.parse(read('package.json'));

test('manual payment proof upload validates image type and size in the browser', () => {
  assert.match(checkout, /image\/jpeg.*image\/png.*image\/webp/);
  assert.match(checkout, /proofFile\.size > 5 \* 1024 \* 1024/);
  assert.match(checkout, /Bukti berhasil dikirim/);
});

test('proof files are uploaded into a private bucket using a user/order scoped path', () => {
  assert.match(checkout, /from\('payment-proofs'\)\.upload\(path/);
  assert.match(checkout, /\$\{userId\}\/\$\{placedOrder\.code\}/);
  assert.match(migration, /VALUES \('payment-proofs', 'payment-proofs', false, 5242880/i);
});

test('storage insert policy requires ownership of a pending order', () => {
  assert.match(migration, /fityora_upload_own_payment_proof[\s\S]*WITH CHECK/i);
  assert.match(migration, /o\.user_id = auth\.uid\(\)[\s\S]*o\.code = \(storage\.foldername\(name\)\)\[2\][\s\S]*o\.status = 'pending'/i);
});

test('proof submission RPC validates authenticated ownership, status, and matching order code', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.submit_payment_proof/i);
  assert.match(migration, /SECURITY DEFINER[\s\S]*SET search_path = pg_catalog, public/i);
  assert.match(migration, /WHERE id = p_order_id AND user_id = v_user_id FOR UPDATE/i);
  assert.match(migration, /split_part\(p_proof_path, '\/', 2\) <> v_order\.code/i);
  assert.match(migration, /v_order\.status <> 'pending'/i);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.submit_payment_proof[\s\S]*FROM PUBLIC, anon/i);
});

test('payment proof submission does not mark order as paid or successful', () => {
  const fn = migration.split('CREATE OR REPLACE FUNCTION public.submit_payment_proof')[1] ?? '';
  assert.match(fn, /SET payment_proof_path = p_proof_path, payment_submitted_at = now\(\)/i);
  assert.doesNotMatch(fn, /SET status\s*=\s*'(processing|success)'/i);
  assert.match(checkout, /Bukti pembayaran tidak otomatis menandai pesanan lunas/i);
});

test('admin can open a short-lived signed URL for a submitted proof', () => {
  assert.match(admin, /o\.payment_proof_path/);
  assert.match(admin, /createSignedUrl\(o\.payment_proof_path!, 60\)/);
  assert.match(admin, /Lihat bukti/);
});

test('release audit includes Phase 37 without a payment gateway dependency', () => {
  assert.match(pkg.scripts['audit:phase37'], /phase37-manual-payment\.test\.mjs/);
  assert.match(pkg.scripts['audit:release'], /npm run audit:phase37/);
  assert.equal(pkg.dependencies?.midtrans, undefined);
  assert.equal(pkg.dependencies?.['@supabase/supabase-js'], '^2.57.4');
});
