-- Phase 62: split full-site closure from order-only maintenance.
-- Existing global maintenance state and all customer/order data are preserved.
-- The order guard is enforced in PostgreSQL, not only in the React UI.

BEGIN;

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS order_maintenance_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS order_maintenance_message text NOT NULL
    DEFAULT 'Pemesanan sedang dihentikan sementara. Silakan coba kembali nanti.';

-- Enforce both maintenance modes for every INSERT into orders, including RPC calls.
-- Author/Admin sessions may continue working while either mode is enabled.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION private.enforce_order_maintenance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_global_enabled boolean;
  v_global_message text;
  v_order_enabled boolean;
  v_order_message text;
  v_role text;
BEGIN
  SELECT
    s.maintenance_enabled,
    s.maintenance_message,
    s.order_maintenance_enabled,
    s.order_maintenance_message
  INTO
    v_global_enabled,
    v_global_message,
    v_order_enabled,
    v_order_message
  FROM public.site_settings AS s
  WHERE s.id = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Status operasional toko belum tersedia. Pesanan baru sementara diblokir.'
      USING ERRCODE = '55000';
  END IF;

  SELECT p.role
    INTO v_role
  FROM public.profiles AS p
  WHERE p.id = (SELECT auth.uid());

  IF COALESCE(v_role, '') IN ('admin', 'author') THEN
    RETURN NEW;
  END IF;

  -- Full-site closure also stops customer-side updates to existing orders,
  -- such as payment-proof submission. Order-only maintenance leaves them open.
  IF TG_OP = 'UPDATE' THEN
    IF COALESCE(v_global_enabled, false) THEN
      RAISE EXCEPTION '%',
        COALESCE(
          NULLIF(BTRIM(v_global_message), ''),
          'Website sedang ditutup sementara untuk pemeliharaan.'
        )
        USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
  END IF;

  IF COALESCE(v_global_enabled, false) THEN
    RAISE EXCEPTION '%',
      COALESCE(
        NULLIF(BTRIM(v_global_message), ''),
        'Website sedang ditutup sementara untuk pemeliharaan.'
      )
      USING ERRCODE = '55000';
  END IF;

  IF COALESCE(v_order_enabled, false) THEN
    RAISE EXCEPTION '%',
      COALESCE(
        NULLIF(BTRIM(v_order_message), ''),
        'Pemesanan sedang dihentikan sementara. Silakan coba kembali nanti.'
      )
      USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.enforce_order_maintenance()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS orders_maintenance_guard ON public.orders;
CREATE TRIGGER orders_maintenance_guard
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_order_maintenance();

-- Hide public order-status lookups during full-site closure. Order-only
-- maintenance intentionally keeps existing-order tracking available.
CREATE OR REPLACE FUNCTION public.lookup_order(code text)
RETURNS TABLE (
  o_code text,
  o_status text,
  o_total_amount numeric,
  o_payment_method text,
  o_brand_name text,
  o_package_name text,
  o_target text,
  o_created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_global_enabled boolean;
  v_role text;
BEGIN
  SELECT s.maintenance_enabled
    INTO v_global_enabled
  FROM public.site_settings AS s
  WHERE s.id = true;

  IF NOT FOUND OR COALESCE(v_global_enabled, false) THEN
    SELECT p.role
      INTO v_role
    FROM public.profiles AS p
    WHERE p.id = (SELECT auth.uid());

    IF COALESCE(v_role, '') NOT IN ('admin', 'author') THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    o.code,
    o.status,
    o.total_amount,
    o.payment_method,
    b.name,
    p.name,
    o.target,
    o.created_at
  FROM public.orders AS o
  LEFT JOIN public.brands AS b ON b.id = o.brand_id
  LEFT JOIN public.packages AS p ON p.id = o.package_id
  WHERE o.code = lookup_order.code
  LIMIT 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.lookup_order(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_order(text) TO anon, authenticated;

-- One Author/Admin-only RPC saves both switches and both customer-facing messages.
CREATE OR REPLACE FUNCTION public.admin_set_maintenance_modes(
  p_global_enabled boolean,
  p_global_message text,
  p_order_enabled boolean,
  p_order_message text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_role text;
  v_result public.site_settings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: silakan masuk sebagai Author/Admin.'
      USING ERRCODE = '42501';
  END IF;

  SELECT p.role
    INTO v_role
  FROM public.profiles AS p
  WHERE p.id = (SELECT auth.uid());

  IF COALESCE(v_role, '') NOT IN ('admin', 'author') THEN
    RAISE EXCEPTION 'Akses ditolak: hanya Author/Admin yang dapat mengatur maintenance.'
      USING ERRCODE = '42501';
  END IF;

  IF p_global_enabled IS NULL OR p_order_enabled IS NULL THEN
    RAISE EXCEPTION 'Kedua status maintenance harus dikirim secara eksplisit.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.site_settings AS s
  SET maintenance_enabled = p_global_enabled,
      maintenance_message = COALESCE(
        NULLIF(LEFT(BTRIM(p_global_message), 240), ''),
        s.maintenance_message
      ),
      order_maintenance_enabled = p_order_enabled,
      order_maintenance_message = COALESCE(
        NULLIF(LEFT(BTRIM(p_order_message), 240), ''),
        s.order_maintenance_message
      ),
      updated_at = now(),
      updated_by = (SELECT auth.uid())
  WHERE s.id = true
  RETURNING s.* INTO v_result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pengaturan maintenance belum dibuat.'
      USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'maintenance_enabled', v_result.maintenance_enabled,
    'maintenance_message', v_result.maintenance_message,
    'order_maintenance_enabled', v_result.order_maintenance_enabled,
    'order_maintenance_message', v_result.order_maintenance_message
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_maintenance_modes(boolean, text, boolean, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_maintenance_modes(boolean, text, boolean, text)
  TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
