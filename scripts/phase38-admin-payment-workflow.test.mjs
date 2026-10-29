import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('member proof upload is restricted to image formats and disables repeat submission', () => {
  const s = read('src/pages/TopupPage.tsx');
  assert.match(s, /image\/jpeg,image\/png,image\/webp/);
  assert.match(s, /proofState === 'uploading' \|\| proofState === 'submitted'/);
  assert.match(s, /MAX_PROOF_SIZE|5 \* 1024 \* 1024|5\s*\*\s*1024\s*\*\s*1024/);
});

test('proof upload uses private storage path and RPC submission instead of marking order paid in the browser', () => {
  const s = read('src/pages/TopupPage.tsx');
  assert.match(s, /storage\.from\('payment-proofs'\)\.upload/);
  assert.match(s, /rpc\('submit_payment_proof'/);
  assert.doesNotMatch(s, /setPlacedOrder\(\s*\{[^}]*payment_status\s*:\s*['"]paid['"]/s);
});

test('admin opens only a short-lived signed URL for submitted proof', () => {
  const s = read('src/pages/AdminPage.tsx');
  assert.match(s, /createSignedUrl\(o\.payment_proof_path!,\s*60\)/);
  assert.match(s, /noopener,noreferrer/);
  assert.match(s, /Lihat bukti/);
});

test('migration creates private bucket and checks proof ownership/order state', () => {
  const s = read('supabase/migrations/20261027010000_manual_payment_proofs.sql');
  assert.match(s, /public\s*=\s*false/i);
  assert.match(s, /auth\.uid\(\)/);
  assert.match(s, /pending/i);
  assert.match(s, /submit_payment_proof/);
});

test('manual supplier fulfillment is explicitly documented and not falsely automated', () => {
  const s = read('PHASE37_MANUAL_PAYMENT_AND_FULFILLMENT.md') + read('PHASE37_MANUAL_PAYMENT_REPORT.md');
  assert.match(s, /manual/i);
  assert.match(s, /no supplier API integration is claimed|no supplier API integration/i);
});

test('Phase 38 is registered in release audit without a payment gateway dependency', () => {
  const p = JSON.parse(read('package.json'));
  assert.match(p.scripts['audit:release'], /audit:phase38/);
  assert.match(p.scripts['audit:phase38'], /phase38-admin-payment-workflow\.test\.mjs/);
  const deps = { ...p.dependencies, ...p.devDependencies };
  assert.equal(Object.keys(deps).some(k => /midtrans|xendit|sekali.?pay|duitku|tripay/i.test(k)), false);
});
