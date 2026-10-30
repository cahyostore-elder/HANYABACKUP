import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const migration = read('supabase/migrations/20261030040000_phase62_dual_maintenance_controls.sql');
const app = read('src/App.tsx');
const login = read('src/pages/LoginPage.tsx');
const topup = read('src/pages/TopupPage.tsx');
const admin = read('src/pages/AdminPage.tsx');
const pkg = JSON.parse(read('package.json'));

test('Phase 62 has two independent persistent maintenance switches', () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS order_maintenance_enabled boolean NOT NULL DEFAULT false/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS order_maintenance_message text NOT NULL/);
  assert.match(migration, /maintenance_enabled = p_global_enabled/);
  assert.match(migration, /order_maintenance_enabled = p_order_enabled/);
  assert.match(migration, /admin_set_maintenance_modes\(boolean, text, boolean, text\)/);
});

test('database blocks customer order inserts and updates while maintenance is active', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION private\.enforce_order_maintenance\(\)/);
  assert.match(migration, /SECURITY DEFINER[\s\S]*?SET search_path = ''/);
  assert.match(migration, /COALESCE\(v_role, ''\) IN \('admin', 'author'\)/);
  assert.match(migration, /BEFORE INSERT OR UPDATE ON public\.orders/);
  assert.match(migration, /IF TG_OP = 'UPDATE' THEN[\s\S]*?IF COALESCE\(v_global_enabled, false\) THEN/);
  assert.match(migration, /IF COALESCE\(v_order_enabled, false\) THEN/);
  assert.match(migration, /REVOKE ALL ON FUNCTION private\.enforce_order_maintenance\(\)[\s\S]*?FROM PUBLIC, anon, authenticated/);
});

test('global closure hides public order lookup but order-only maintenance preserves existing-order tracking', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.lookup_order\(code text\)/);
  assert.match(migration, /IF NOT FOUND OR COALESCE\(v_global_enabled, false\) THEN/);
  assert.match(migration, /RETURN QUERY[\s\S]*?FROM public\.orders AS o/);
});

test('global maintenance grants staff bypass and leaves only a login route for customers', () => {
  assert.match(app, /profile\?\.role === 'author' \|\| profile\?\.role === 'admin'/);
  assert.match(app, /maintenance\.globalEnabled && !isAuthor && route\.name !== 'login'/);
  assert.match(app, /loginOnly=\{maintenance\.globalEnabled && !isAuthor\}/);
  assert.match(login, /maintenanceAccessOnly/);
  assert.match(login, /Login hanya tersedia untuk Author\/Admin/);
  assert.match(login, /maintenanceAccessOnly \? \([\s\S]*?Login hanya tersedia untuk Author\/Admin/);
  assert.match(login, /: \([\s\S]*?navigate\('\/signup'\)/);
});

test('order-only maintenance keeps catalog visible while preventing customer checkout', () => {
  assert.match(topup, /if \(orderMaintenanceEnabled && !isAuthor\)/);
  assert.match(topup, /Pemesanan sedang ditutup sementara/);
  assert.match(topup, /disabled=\{placing \|\| \(orderMaintenanceEnabled && !isAuthor\)\}/);
  assert.match(admin, /2\. Maintenance pemesanan/);
  assert.match(admin, /Riwayat, cek status, dan penyelesaian pesanan lama tetap tersedia/);
  assert.match(admin, /cek status/i);
});

test('Author dashboard can save both modes and the Phase 62 audit is part of release checks', () => {
  assert.match(admin, /admin_set_maintenance_modes/);
  assert.match(admin, /Tutup Website/);
  assert.match(admin, /Buka Website/);
  assert.match(admin, /Tutup Pemesanan/);
  assert.match(admin, /Buka Pemesanan/);
  assert.match(pkg.scripts['audit:phase62'], /phase62-dual-maintenance\.test\.mjs/);
  assert.match(pkg.scripts['audit:release'], /audit:phase62/);
});
