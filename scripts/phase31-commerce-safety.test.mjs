import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');

function paymentIds() {
  const source = read('src/lib/payment.ts');
  return [...source.matchAll(/\bid:\s*'([^']+)'/g)].map((match) => match[1]);
}

test('checkout requires an authenticated session and guards duplicate submissions', () => {
  const source = read('src/pages/TopupPage.tsx');
  assert.match(source, /if\s*\(!session\)\s*\{[\s\S]{0,120}navigate\('\/login'\)/);
  assert.match(source, /placingLock\.current/);
  assert.match(source, /finally\s*\{[\s\S]{0,180}placingLock\.current\s*=\s*false/);
});

test('checkout delegates authoritative price and order creation to database RPC', () => {
  const source = read('src/pages/TopupPage.tsx');
  assert.match(source, /supabase\.rpc\('create_topup_order'/);
  assert.match(source, /p_payment_method:\s*method\.id/);
  assert.match(source, /if\s*\(orderError\s*\|\|\s*!order\?\.code\s*\|\|\s*!Number\.isFinite\(returnedTotal\)/);
  assert.match(source, /p_request_id:\s*idempotencyRequest\.id/);
});

test('payment method identifiers are unique and maintenance method is blocked', () => {
  const ids = paymentIds();
  assert.ok(ids.length >= 5, 'expected payment methods in configuration');
  assert.equal(new Set(ids).size, ids.length, 'duplicate payment method IDs');
  const source = read('src/pages/TopupPage.tsx');
  assert.match(source, /!method\s*\|\|\s*method\.maintenance/);
});

test('official WhatsApp destination is consistent and uses wa.me', () => {
  const source = read('src/lib/contact.ts');
  assert.match(source, /whatsappNumber:\s*'628139525985'/);
  assert.match(source, /whatsappLink:\s*'https:\/\/wa\.me\/628139525985'/);
});

test('customer-facing order lookup validates the code before querying', () => {
  const source = read('src/pages/OrderStatusPage.tsx');
  assert.match(source, /Format kode order tidak valid/);
  assert.match(source, /lookup_order/);
});

test('release runbook separates manual payment review from automated gateway claims', () => {
  const docs = read('PHASE31_COMMERCE_SAFETY.md').toLowerCase();
  for (const phrase of ['do not mark an order paid from a screenshot alone', 'verify each recipient/account number', 'fulfillment', 'service_role']) {
    assert.ok(docs.includes(phrase), `missing safety instruction: ${phrase}`);
  }
});

test('database migrations retain order creation and scoped lookup hardening', () => {
  const migrations = readdirSync(path.join(root, 'supabase/migrations'))
    .filter((name) => name.endsWith('.sql'))
    .map((name) => read(`supabase/migrations/${name}`)).join('\n');
  assert.match(migrations, /create_topup_order/i);
  assert.match(migrations, /lookup_order/i);
  assert.match(migrations, /search_path\s*=\s*pg_catalog,\s*public/i);
});
