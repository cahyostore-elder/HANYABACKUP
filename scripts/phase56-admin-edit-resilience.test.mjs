import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRupiah } from '../src/lib/bulkPricing.mjs';

const admin = readFileSync(new URL('../src/pages/AdminPage.tsx', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/20261028040000_phase56_atomic_admin_package_save.sql', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

 test('price editor parses digit-only rupiah and rejects invalid or excessive prices', () => {
  assert.equal(parseRupiah('15000'), 15000);
  assert.equal(parseRupiah('1500000'), 1500000);
  assert.equal(parseRupiah('99.999.999'), 99999999);
  assert.equal(parseRupiah(''), null);
  assert.equal(parseRupiah('-100'), null);
  assert.equal(parseRupiah('10.5'), null);
  assert.equal(parseRupiah('100000000'), null);
});

test('modal focus lifecycle is stable while controlled form fields re-render', () => {
  assert.match(admin, /const onCloseRef = useRef\(onClose\)/);
  assert.match(admin, /function readSortOrder\(value: unknown\): number \| null/);
  assert.match(admin, /useEffect\(\(\) => \{ onCloseRef\.current = onClose; \}, \[onClose\]\)/);
  assert.match(admin, /event\.key === 'Escape'[\s\S]*?onCloseRef\.current\(\)/);
  assert.match(admin, /\}, \[\]\);/);
  const modal = admin.slice(admin.indexOf('function Modal'), admin.indexOf('function Field'));
  assert.match(modal, /document\.addEventListener\('keydown', handleKeyDown\);[\s\S]*?\}, \[\]\);/);
  assert.match(modal, /firstField \?\? fallbackButton \?\? panelRef\.current/);
});

test('package metadata and both prices use one atomic RPC, not sequential writes', () => {
  assert.match(admin, /supabase\.rpc\('admin_save_package'/);
  assert.match(admin, /saved\.saved_package_id/);
  assert.match(admin, /Number\(saved\.saved_price\) !== price/);
  assert.match(admin, /saved\.saved_supplier_cost == null \? null : Number\(saved\.saved_supplier_cost\)/);
  const packageSave = admin.slice(admin.indexOf('function PackagesManager'), admin.indexOf('function BrandsManager'));
  assert.doesNotMatch(packageSave, /supabase\.from\('packages'\)\.(?:insert|update)/);
});

test('atomic package RPC enforces role, valid inputs, supplier cost and authenticated-only execution', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.admin_save_package/);
  assert.match(migration, /SECURITY DEFINER/);
  assert.match(migration, /SET search_path = pg_catalog, public/);
  assert.match(migration, /auth\.uid\(\) IS NULL OR NOT public\.is_admin\(\)/);
  assert.match(migration, /p_price <> trunc\(p_price\)/);
  assert.match(migration, /p_supplier_cost <> trunc\(p_supplier_cost\)/);
  assert.match(migration, /INSERT INTO public\.package_supplier_costs AS existing/);
  assert.match(migration, /ON CONFLICT \(package_id\) DO UPDATE/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.admin_save_package[\s\S]*FROM PUBLIC, anon/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.admin_save_package[\s\S]*TO authenticated/);
  assert.match(migration, /NOTIFY pgrst, 'reload schema'/);
});

test('admin save handlers release loading state on success, database error and network exception', () => {
  for (const fragment of [
    'function PackagesManager', 'function BrandsManager', 'function CategoriesManager',
    'function PromosTab', 'function TestimonialsTab', 'function FaqsTab',
  ]) {
    const start = admin.indexOf(fragment);
    assert.notEqual(start, -1, `missing ${fragment}`);
    const next = admin.indexOf('\nfunction ', start + fragment.length);
    const section = admin.slice(start, next === -1 ? undefined : next);
    assert.match(section, /finally\s*\{\s*setSaving\(false\);\s*\}/, `${fragment} missing finally cleanup`);
  }
  assert.match(admin, /finally\s*\{\s*setMaintenanceSaving\(false\);\s*\}/);
  assert.match(admin, /Data dashboard gagal dimuat:/);
});

test('save/cancel controls prevent repeat saves and closing the editor mid-request', () => {
  assert.match(admin, /if \(saving\) return;/);
  assert.match(admin, /disabled=\{saving\}[^>]*>\s*\{saving \?/s);
  assert.match(admin, /disabled=\{saving\} className="btn-ghost/);
  assert.match(admin, /onClose=\{\(\) => \{ if \(!saving\) setEditing\(null\); \}\}/);
});

test('Phase 56 automated audit is registered in release audit', () => {
  assert.equal(packageJson.scripts['audit:phase56'], 'node --test scripts/phase56-admin-edit-resilience.test.mjs');
  assert.match(packageJson.scripts['audit:release'], /audit:phase56/);
});
