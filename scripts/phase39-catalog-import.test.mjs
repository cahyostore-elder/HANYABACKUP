import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20261027020000_phase39_catalog_import.sql', 'utf8');
const topup = fs.readFileSync('src/pages/TopupPage.tsx', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

test('Phase 39 migration imports all submitted telecom provider codes including exact XL source code', () => {
  for (const code of ['PAXS5','PNDST5','PTSEL2','PTRI5','PSMPN5','PTXLS5','PTLXS10','TKNPLN5']) {
    assert.ok(migration.includes(`'${code}'`), `missing ${code}`);
  }
  assert.match(migration, /ADD COLUMN IF NOT EXISTS provider_code/);
});

test('catalog import does not invent prices and blocks checkout selection until admin sets price', () => {
  assert.match(migration, /'Kode produk: .*harga perlu diverifikasi admin', 0,/);
  assert.match(migration, /'Harga perlu diverifikasi admin sebelum penjualan', 0,/);
  assert.match(topup, /disabled=\{Number\(p\.price\) <= 0\}/);
  assert.match(topup, /Harga belum diatur/);
});

test('all supplied game denominations are represented in migration and import is idempotent by brand/name', () => {
  for (const name of ['31 CP','40 FC Points','5 Diamond','60 Genesis Crystals','16 Tokens','5 Diamonds','30 UC','50 Robux','100 Goldstar','475 VP']) {
    assert.ok(migration.includes(`'${name}'`), `missing denomination ${name}`);
  }
  assert.match(migration, /NOT EXISTS \(SELECT 1 FROM packages p WHERE p\.brand_id=b\.id AND lower\(p\.name\)=lower\(/);
  assert.match(migration, /ON CONFLICT \(slug\) DO NOTHING/);
});

test('Phase 39 audit is registered', () => {
  assert.match(pkg.scripts['audit:release'], /audit:phase39/);
  assert.match(pkg.scripts['audit:phase39'], /phase39-catalog-import\.test\.mjs/);
});
