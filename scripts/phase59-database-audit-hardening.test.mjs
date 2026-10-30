import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const sql = read('supabase/migrations/20261030020000_phase59_database_policy_index_hardening.sql');
const pkg = JSON.parse(read('package.json'));

test('rebuilds public catalog admin policies as separate insert/update/delete actions', () => {
  for (const table of ['brands','faqs','packages','promo_banners','testimonials','topup_categories']) {
    assert.ok(sql.includes('DROP POLICY IF EXISTS staff_manage_' + table + ' ON public.' + table));
    assert.ok(sql.includes('CREATE POLICY staff_insert_' + table));
    assert.ok(sql.includes('CREATE POLICY staff_update_' + table));
    assert.ok(sql.includes('CREATE POLICY staff_delete_' + table));
  }
  for (const duplicate of ['read_brands','read_faqs','read_packages','read_promo_banners','read_testimonials','read_topup_categories']) assert.ok(sql.includes('DROP POLICY IF EXISTS ' + duplicate));
});

test('reduces profile/order read policies without granting member access to other users orders', () => {
  assert.ok(sql.includes('DROP POLICY IF EXISTS read_public_profile ON public.profiles'));
  assert.ok(sql.includes('(SELECT auth.uid()) = id OR (SELECT public.is_admin())'));
  assert.ok(sql.includes('DROP POLICY IF EXISTS select_own_orders ON public.orders'));
  assert.ok(sql.includes('DROP POLICY IF EXISTS staff_read_orders ON public.orders'));
  assert.ok(sql.includes('(SELECT auth.uid()) = user_id OR (SELECT public.is_admin())'));
});

test('adds indexes for every foreign key reported by the live performance advisor', () => {
  for (const idx of ['idx_orders_brand_id','idx_orders_category_id','idx_orders_package_id','idx_orders_payment_verified_by','idx_orders_fulfillment_completed_by','idx_site_settings_updated_by']) assert.ok(sql.includes('CREATE INDEX IF NOT EXISTS ' + idx));
  for (const duplicate of ['idx_brands_category','orders_pending_amount_idx','packages_brand_idx']) assert.ok(sql.includes('DROP INDEX IF EXISTS public.' + duplicate));
});

test('pins legacy order-code helper and revokes browser access to obsolete security-definer RPCs', () => {
  assert.ok(sql.includes('SET search_path = pg_catalog'));
  assert.ok(sql.includes('REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated'));
  assert.ok(sql.includes('REVOKE ALL ON FUNCTION public.admin_set_package_supplier_cost(uuid, numeric) FROM PUBLIC, anon, authenticated'));
  assert.ok(sql.includes('REVOKE ALL ON FUNCTION public.admin_preview_package_pricing() FROM PUBLIC, anon, authenticated'));
  assert.ok(sql.includes('REVOKE ALL ON FUNCTION public.admin_apply_package_pricing(uuid[]) FROM PUBLIC, anon, authenticated'));
});

test('Phase 59 is part of the release audit chain', () => {
  assert.equal(pkg.scripts['audit:phase59'], 'node --test scripts/phase59-database-audit-hardening.test.mjs');
  assert.ok(pkg.scripts['audit:release'].includes('audit:phase59'));
});
