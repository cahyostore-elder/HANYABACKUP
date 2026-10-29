import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');
test('Phase 41 migration restricts order deletion and maintenance changes to admin/author RPC', () => {
  const sql = read('supabase/migrations/20261027040000_phase41_admin_order_delete_site_maintenance.sql');
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.admin_delete_order/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.admin_set_site_maintenance/i);
  assert.match(sql, /COALESCE\(v_role, ''\) NOT IN \('admin', 'author'\)/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.admin_delete_order\(uuid\) FROM PUBLIC, anon/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.admin_delete_order\(uuid\) TO authenticated/i);
  assert.match(sql, /ALTER TABLE public\.site_settings ENABLE ROW LEVEL SECURITY/i);
});
test('Admin UI calls guarded RPCs and asks confirmation before deleting orders', () => {
  const admin = read('src/pages/AdminPage.tsx');
  assert.match(admin, /admin_delete_order/);
  assert.match(admin, /Hapus pesanan .* secara permanen/);
  assert.match(admin, /admin_set_site_maintenance/);
  assert.match(admin, /Aktifkan Maintenance/);
  assert.match(admin, /Buka Kembali Website/);
});
test('Whole-site maintenance gate exempts admin dashboard and polls Supabase setting', () => {
  const app = read('src/App.tsx');
  assert.match(app, /maintenance\?\.enabled && route\.name !== 'admin'/);
  assert.match(app, /site_settings/);
  assert.match(app, /if \(!channel\)/);
  assert.match(app, /setInterval\(\(\) => \{ void loadMaintenance\(\); \}, 30000\)/);
});
