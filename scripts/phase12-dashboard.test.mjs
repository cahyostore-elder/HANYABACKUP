import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const dashboard = readFileSync(new URL('../src/pages/DashboardPage.tsx', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../src/pages/AdminPage.tsx', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
test('dashboard has accessible order search and status filter', () => {
  assert.match(dashboard, /aria-label="Cari riwayat transaksi"/);
  assert.match(dashboard, /aria-label="Filter status transaksi"/);
  assert.match(dashboard, /pagedOrders\.map/);
  assert.match(dashboard, /visibleOrders\.slice/);
});
test('dashboard reports failed order history and exposes retry', () => {
  assert.match(dashboard, /Riwayat transaksi gagal dimuat/);
  assert.match(dashboard, /setReloadOrders\(\(value\) => value \+ 1\)/);
  assert.match(dashboard, /role="alert"/);
});
test('dashboard protects against late responses after unmount', () => {
  assert.match(dashboard, /let active = true/);
  assert.match(dashboard, /if \(!active\) return/);
  assert.match(dashboard, /return \(\) => \{ active = false; \}/);
});
test('admin order list already supports search and status filtering', () => {
  assert.match(admin, /Cari kode order, tujuan, atau brand/);
  assert.match(admin, /statusFilter === 'all' \|\| o\.status === statusFilter/);
});
test('Phase 12 audit command is registered', () => {
  assert.equal(pkg.scripts['audit:phase12'], 'node --test scripts/phase12-dashboard.test.mjs');
});
