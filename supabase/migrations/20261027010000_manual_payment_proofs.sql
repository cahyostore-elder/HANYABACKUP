-- FITYORA TOPUP Phase 37: private payment proof storage and owner-checked submission.
-- Review the SQL, then apply it to the intended Supabase project before enabling uploads.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_proof_path text,
  ADD COLUMN IF NOT EXISTS payment_submitted_at timestamptz;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('payment-proofs', 'payment-proofs', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS fityora_upload_own_payment_proof ON storage.objects;
CREATE POLICY fityora_upload_own_payment_proof ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.user_id = auth.uid()
        AND o.code = (storage.foldername(name))[2]
        AND o.status = 'pending'
    )
  );

DROP POLICY IF EXISTS fityora_read_own_payment_proof ON storage.objects;
CREATE POLICY fityora_read_own_payment_proof ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
    )
  );

DROP POLICY IF EXISTS fityora_delete_own_payment_proof ON storage.objects;
CREATE POLICY fityora_delete_own_payment_proof ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.user_id = auth.uid()
        AND o.code = (storage.foldername(name))[2]
        AND o.status = 'pending'
        AND o.payment_proof_path IS NULL
    )
  );

CREATE OR REPLACE FUNCTION public.submit_payment_proof(p_order_id uuid, p_proof_path text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_order public.orders%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Silakan masuk untuk mengirim bukti pembayaran.';
  END IF;
  IF p_proof_path IS NULL OR length(p_proof_path) > 512
    OR p_proof_path !~ ('^' || v_user_id::text || '/FS[A-Z0-9-]+/[A-Za-z0-9._-]+$') THEN
    RAISE EXCEPTION 'Lokasi bukti pembayaran tidak valid.';
  END IF;

  SELECT * INTO v_order FROM public.orders
    WHERE id = p_order_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan.';
  END IF;
  IF v_order.status <> 'pending' THEN
    RAISE EXCEPTION 'Bukti hanya dapat dikirim saat pesanan masih menunggu pembayaran.';
  END IF;
  IF split_part(p_proof_path, '/', 2) <> v_order.code THEN
    RAISE EXCEPTION 'Bukti tidak cocok dengan kode pesanan.';
  END IF;
  IF v_order.payment_proof_path IS NOT NULL THEN
    RAISE EXCEPTION 'Bukti pembayaran sudah dikirim untuk pesanan ini.';
  END IF;

  UPDATE public.orders
    SET payment_proof_path = p_proof_path, payment_submitted_at = now()
    WHERE id = p_order_id;
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_payment_proof(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_payment_proof(uuid, text) TO authenticated;
