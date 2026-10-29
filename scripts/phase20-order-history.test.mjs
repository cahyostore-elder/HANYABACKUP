import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dashboard = readFileSync(new URL('../src/pages/DashboardPage.tsx', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('history hooks execute before the unauthenticated early return', () => {
  assert.ok(dashboard.indexOf('const visibleOrders = useMemo') < dashboard.indexOf('if (!session)'));
  assert.match(dashboard, /Keep hooks unconditional/);
});

test('order history filters by code, target, brand, package and status', () => {
  assert.match(dashboard, /const matchesStatus = orderStatus === 'all' \|\| order\.status === orderStatus/);
  assert.match(dashboard, /order\.code, order\.target, order\.brand\?\.name, order\.package\?\.name/);
  assert.match(dashboard, /toLocaleLowerCase\('id-ID'\)/);
});

test('order history paginates long lists and exposes paging state', () => {
  assert.match(dashboard, /const pageSize = 8/);
  assert.match(dashboard, /visibleOrders\.slice\(\(safeOrderPage - 1\) \* pageSize, safeOrderPage \* pageSize\)/);
  assert.match(dashboard, /Halaman \{safeOrderPage\} dari \{pageCount\}/);
  assert.match(dashboard, /Sebelumnya/);
  assert.match(dashboard, /Berikutnya/);
});

test('filters reset page to avoid landing on an empty later page', () => {
  assert.match(dashboard, /setOrderSearch\(event\.target\.value\); setOrderPage\(1\)/);
  assert.match(dashboard, /setOrderStatus\(event\.target\.value\); setOrderPage\(1\)/);
});

test('orders expose copy-code affordance and honest clipboard fallback', () => {
  assert.match(dashboard, /navigator\.clipboard\?\.writeText/);
  assert.match(dashboard, /Salin kode order/);
  assert.match(dashboard, /Kode tidak dapat disalin otomatis/);
});

test('order detail disclosure is accessible and provides date/payment/status explanations', () => {
  assert.match(dashboard, /aria-expanded=\{expandedOrderId === o\.id\}/);
  assert.match(dashboard, /Tanggal order/);
  assert.match(dashboard, /Metode pembayaran/);
  assert.match(dashboard, /belum dinyatakan berhasil/);
  assert.match(dashboard, /ditandai gagal/);
});

test('spending total includes only orders explicitly marked successful', () => {
  assert.match(dashboard, /const successfulOrders = orders\.filter\(\(order\) => order\.status === 'success'\)/);
  assert.match(dashboard, /Total Belanja Berhasil/);
});

test('database history query is scoped to the authenticated user and newest first', () => {
  assert.match(dashboard, /\.eq\('user_id', session\.user\.id\)/);
  assert.match(dashboard, /\.order\('created_at', \{ ascending: false \}\)/);
});

test('Phase 20 test command is registered', () => {
  assert.equal(pkg.scripts['audit:phase20'], 'node --test scripts/phase20-order-history.test.mjs');
});
