import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');
test('Admin order cards show weekday, day, month, year, and time', () => {
  const admin = read('src/pages/AdminPage.tsx');
  assert.match(admin, /weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'/);
  assert.match(admin, /Dipesan:/);
});
test('Order status page displays full localized order date', () => {
  const page = read('src/pages/OrderStatusPage.tsx');
  assert.match(page, /label="Waktu Order" value=\{new Date\(result\.order\.o_created_at\)\.toLocaleString\('id-ID', \{ weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'/);
});
test('Maintenance copy clearly closes all public pages and leaves only admin accessible', () => {
  const app = read('src/App.tsx');
  const admin = read('src/pages/AdminPage.tsx');
  assert.match(app, /maintenance\.globalEnabled && !isAuthor && route\.name !== 'login'/);
  assert.match(admin, /Pengunjung tidak dapat membuka beranda, katalog, dashboard pelanggan, checkout, atau cek status/);
  assert.match(admin, /Hanya Author\/Admin yang dapat masuk dan memakai dashboard/i);
});
