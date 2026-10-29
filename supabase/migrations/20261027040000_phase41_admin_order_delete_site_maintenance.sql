-- Phase 41: admin-only order deletion and global storefront maintenance switch.
-- Apply only after reviewing the existing production migration history and taking a backup.

CREATE TABLE IF NOT EXISTS public.site_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  maintenance_enabled boolean NOT NULL DEFAULT false,
  maintenance_message text NOT NULL DEFAULT 'Kami sedang melakukan pemeliharaan. Silakan kembali beberapa saat lagi.',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL
);
INSERT INTO public.site_settings (id, maintenance_enabled, maintenance_message)
VALUES (true, false, 'Kami sedang melakukan pemeliharaan. Silakan kembali beberapa saat lagi.')
ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.site_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.site_settings TO anon, authenticated;
DROP POLICY IF EXISTS site_settings_public_read ON public.site_settings;
CREATE POLICY site_settings_public_read ON public.site_settings FOR SELECT TO anon, authenticated USING (id = true);

CREATE OR REPLACE FUNCTION public.admin_set_site_maintenance(p_enabled boolean, p_message text DEFAULT NULL)
RETURNS public.site_settings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_role text; v_result public.site_settings;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF auth.uid() IS NULL OR COALESCE(v_role, '') NOT IN ('admin', 'author') THEN
    RAISE EXCEPTION 'forbidden: admin access required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.site_settings
     SET maintenance_enabled = p_enabled,
         maintenance_message = COALESCE(NULLIF(trim(p_message), ''), maintenance_message),
         updated_at = now(), updated_by = auth.uid()
   WHERE id = true RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_site_maintenance(boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_site_maintenance(boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_order(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF auth.uid() IS NULL OR COALESCE(v_role, '') NOT IN ('admin', 'author') THEN
    RAISE EXCEPTION 'forbidden: admin access required' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found' USING ERRCODE = 'P0002';
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_delete_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_order(uuid) TO authenticated;
