import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../supabase/migrations/20261027050000_phase44_site_settings_maintenance_only.sql', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../src/pages/AdminPage.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('Phase 44 creates and seeds site_settings idempotently', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.site_settings/i);
  assert.match(migration, /ON CONFLICT \(id\) DO NOTHING/i);
  assert.match(migration, /ALTER TABLE public\.site_settings ENABLE ROW LEVEL SECURITY/i);
});

test('maintenance RPC is restricted to admin and author', () => {
  assert.match(migration, /COALESCE\(v_role, ''\) NOT IN \('admin', 'author'\)/i);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.admin_set_site_maintenance\(boolean, text\) FROM PUBLIC, anon/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.admin_set_site_maintenance\(boolean, text\) TO authenticated/i);
});

test('migration does not overwrite order deletion workflow', () => {
  assert.doesNotMatch(migration, /admin_delete_order/i);
  assert.doesNotMatch(migration, /DELETE FROM public\.orders/i);
});

test('missing optional settings no longer blocks the rest of admin data', () => {
  assert.match(admin, /const firstError = \[o, b, c, p, pr, t, f\]/);
  assert.match(admin, /maintenanceSettingsAvailable/);
  assert.match(admin, /Terapkan migration Phase 44 terlebih dahulu/i);
});

test('app stops repeated maintenance polling if settings table is unavailable', () => {
  assert.match(app, /if \(!channel\)/);
  assert.match(app, /if \(error\)[\s\S]*setMaintenance\(\{ enabled: false, message: '' \}\);\s*return;/);
  assert.match(app, /refreshTimer = window\.setInterval\(\(\) => \{ void loadMaintenance\(\); \}, 30000\)/);
});
