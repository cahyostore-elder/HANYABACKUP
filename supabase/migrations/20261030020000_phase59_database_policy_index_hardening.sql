-- Phase 59: remove redundant RLS policies, add missing FK indexes and pin legacy helper paths.
-- Does not update catalog prices, supplier costs, orders or user records.
BEGIN;

-- Keep public catalog reads, but make admin writes operation-specific so read and ALL policies do not overlap.
DROP POLICY IF EXISTS read_brands ON public.brands;
DROP POLICY IF EXISTS staff_manage_brands ON public.brands;
DROP POLICY IF EXISTS staff_insert_brands ON public.brands;
DROP POLICY IF EXISTS staff_update_brands ON public.brands;
DROP POLICY IF EXISTS staff_delete_brands ON public.brands;
CREATE POLICY staff_insert_brands ON public.brands FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY staff_update_brands ON public.brands FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY staff_delete_brands ON public.brands FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS read_faqs ON public.faqs;
DROP POLICY IF EXISTS staff_manage_faqs ON public.faqs;
DROP POLICY IF EXISTS staff_insert_faqs ON public.faqs;
DROP POLICY IF EXISTS staff_update_faqs ON public.faqs;
DROP POLICY IF EXISTS staff_delete_faqs ON public.faqs;
CREATE POLICY staff_insert_faqs ON public.faqs FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY staff_update_faqs ON public.faqs FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY staff_delete_faqs ON public.faqs FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS read_packages ON public.packages;
DROP POLICY IF EXISTS staff_manage_packages ON public.packages;
DROP POLICY IF EXISTS staff_insert_packages ON public.packages;
DROP POLICY IF EXISTS staff_update_packages ON public.packages;
DROP POLICY IF EXISTS staff_delete_packages ON public.packages;
CREATE POLICY staff_insert_packages ON public.packages FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY staff_update_packages ON public.packages FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY staff_delete_packages ON public.packages FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS read_promo_banners ON public.promo_banners;
DROP POLICY IF EXISTS staff_manage_promo_banners ON public.promo_banners;
DROP POLICY IF EXISTS staff_insert_promo_banners ON public.promo_banners;
DROP POLICY IF EXISTS staff_update_promo_banners ON public.promo_banners;
DROP POLICY IF EXISTS staff_delete_promo_banners ON public.promo_banners;
CREATE POLICY staff_insert_promo_banners ON public.promo_banners FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY staff_update_promo_banners ON public.promo_banners FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY staff_delete_promo_banners ON public.promo_banners FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS read_testimonials ON public.testimonials;
DROP POLICY IF EXISTS staff_manage_testimonials ON public.testimonials;
DROP POLICY IF EXISTS staff_insert_testimonials ON public.testimonials;
DROP POLICY IF EXISTS staff_update_testimonials ON public.testimonials;
DROP POLICY IF EXISTS staff_delete_testimonials ON public.testimonials;
CREATE POLICY staff_insert_testimonials ON public.testimonials FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY staff_update_testimonials ON public.testimonials FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY staff_delete_testimonials ON public.testimonials FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS read_topup_categories ON public.topup_categories;
DROP POLICY IF EXISTS staff_manage_topup_categories ON public.topup_categories;
DROP POLICY IF EXISTS staff_insert_topup_categories ON public.topup_categories;
DROP POLICY IF EXISTS staff_update_topup_categories ON public.topup_categories;
DROP POLICY IF EXISTS staff_delete_topup_categories ON public.topup_categories;
CREATE POLICY staff_insert_topup_categories ON public.topup_categories FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY staff_update_topup_categories ON public.topup_categories FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY staff_delete_topup_categories ON public.topup_categories FOR DELETE TO authenticated USING (public.is_admin());

-- Profiles: members read their own profile; Author/Admin can read all. No broad member listing.
DROP POLICY IF EXISTS profiles_read_admin ON public.profiles;
DROP POLICY IF EXISTS profiles_read_own ON public.profiles;
DROP POLICY IF EXISTS read_public_profile ON public.profiles;
DROP POLICY IF EXISTS profiles_read_own_or_admin ON public.profiles;
CREATE POLICY profiles_read_own_or_admin ON public.profiles FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id OR (SELECT public.is_admin()));
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
DROP POLICY IF EXISTS update_own_profile ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- Orders: one SELECT policy for owner and staff; no duplicated owner/admin SELECT policies.
DROP POLICY IF EXISTS orders_read_own ON public.orders;
DROP POLICY IF EXISTS select_own_orders ON public.orders;
DROP POLICY IF EXISTS staff_read_orders ON public.orders;
DROP POLICY IF EXISTS orders_read_own_or_admin ON public.orders;
CREATE POLICY orders_read_own_or_admin ON public.orders FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

-- Private pricing tables intentionally have no browser read/write path.
-- Restrictive policies remain a deny-all backstop even if a permissive policy is added later.
DROP POLICY IF EXISTS package_supplier_costs_browser_deny ON public.package_supplier_costs;
CREATE POLICY package_supplier_costs_browser_deny
  ON public.package_supplier_costs AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS package_pricing_audit_browser_deny ON public.package_pricing_audit;
CREATE POLICY package_pricing_audit_browser_deny
  ON public.package_pricing_audit AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Drop confirmed duplicate/unused indexes and keep one covering index for each relation.
DROP INDEX IF EXISTS public.idx_brands_category;
DROP INDEX IF EXISTS public.orders_pending_amount_idx;
DROP INDEX IF EXISTS public.packages_brand_idx;
CREATE INDEX IF NOT EXISTS idx_orders_brand_id ON public.orders (brand_id);
CREATE INDEX IF NOT EXISTS idx_orders_category_id ON public.orders (category_id);
CREATE INDEX IF NOT EXISTS idx_orders_package_id ON public.orders (package_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_verified_by ON public.orders (payment_verified_by);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_completed_by ON public.orders (fulfillment_completed_by);
CREATE INDEX IF NOT EXISTS idx_site_settings_updated_by ON public.site_settings (updated_by);

-- Pin the legacy helper path. This function is not SECURITY DEFINER and is not the order creation RPC.
CREATE OR REPLACE FUNCTION public.generate_order_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
DECLARE
  c text;
BEGIN
  c := 'FS' || to_char(now(), 'YYMMDD') || lpad(floor(random() * 10000)::text, 4, '0');
  RETURN c;
END;
$function$;

-- This event-trigger function is invoked by PostgreSQL's event trigger, never by the browser API.
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- Retire obsolete RPCs replaced by the audited Phase 57/58 dashboard flow.
REVOKE ALL ON FUNCTION public.admin_preview_package_pricing() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_set_package_supplier_cost(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_apply_package_pricing(uuid[]) FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
