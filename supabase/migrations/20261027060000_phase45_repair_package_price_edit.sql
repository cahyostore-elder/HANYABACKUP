-- Phase 45: Repair admin package/price editing permissions.
-- Safe to re-run. Does not alter existing prices or order history.
-- Requires the existing public.is_admin() helper used by the admin dashboard.

BEGIN;

ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

-- Browser clients need table privileges; RLS still restricts writes to staff.
GRANT SELECT ON TABLE public.packages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.packages TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.packages FROM anon, PUBLIC;

DROP POLICY IF EXISTS staff_manage_packages ON public.packages;
CREATE POLICY staff_manage_packages
  ON public.packages
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Public catalogue remains readable.
DROP POLICY IF EXISTS read_packages ON public.packages;
CREATE POLICY read_packages
  ON public.packages
  FOR SELECT
  TO anon, authenticated
  USING (true);

COMMIT;

-- Verify the policy exists (read-only result):
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'packages'
ORDER BY policyname;
