import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/pages/OrderStatusPage.tsx', import.meta.url), 'utf8');
test('status page has manual refresh using existing order code', () => {
  assert.match(source, /Perbarui status/);
  assert.match(source, /lookup\(result\.order\.o_code\)/);
});
test('status page explains pending is not success', () => {
  assert.match(source, /belum berarti transaksi berhasil/);
});
test('lookup validates code and reports format errors', () => {
  assert.match(source, /\^\[A-Z0-9-\]\+\$/);
  assert.match(source, /Format kode order tidak valid/);
});
test('input is accessible and disables repeated lookup while loading', () => {
  assert.match(source, /aria-label="Kode order"/);
  assert.match(source, /aria-describedby="order-code-help"/);
  assert.match(source, /result\.kind === 'loading' \|\| !code\.trim\(\)/);
});
test('refresh failure preserves the previously loaded order and prevents concurrent lookups', () => {
  assert.match(source, /const checkingLock = useRef\(false\)/);
  assert.match(source, /if \(keepShowingFoundOrder\) setLookupError\(message\)/);
  assert.match(source, /checkingLock\.current = false/);
  assert.match(source, /disabled=\{isChecking\}/);
  assert.match(source, /Data status terakhir tetap ditampilkan/);
});

test('status details include explicit messaging for each known state', () => {
  for (const status of ['pending', 'processing', 'success']) assert.ok(source.includes(`result.order.o_status === '${status}'`));
  assert.match(source, /Pesanan ditandai gagal/);
});
