import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const admin = readFileSync(new URL('../src/pages/AdminPage.tsx', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
test('admin order list supports date range filters', () => {
  assert.match(admin, /const \[dateFrom, setDateFrom\] = useState\(''\)/);
  assert.match(admin, /const \[dateTo, setDateTo\] = useState\(''\)/);
  assert.match(admin, /createdDate >= dateFrom/);
  assert.match(admin, /createdDate <= dateTo/);
});
test('admin can reset all order filters', () => {
  assert.match(admin, /setSearch\(''\); setStatusFilter\('all'\); setDateFrom\(''\); setDateTo\(''\)/);
});
test('status changes require explicit confirmation', () => {
  assert.match(admin, /window\.confirm\(`Ubah pesanan/);
  assert.match(admin, /pembayaran sudah benar-benar diterima dan diverifikasi/);
  assert.match(admin, /top-up sudah benar-benar selesai/);
});
test('order search includes package names', () => {
  assert.match(admin, /o\.package\?\.name \|\| ''\)\.toLowerCase\(\)\.includes\(q\)/);
});
test('Phase 14 audit command is registered', () => {
  assert.equal(pkg.scripts['audit:phase14'], 'node --test scripts/phase14-admin-ux.test.mjs');
});
