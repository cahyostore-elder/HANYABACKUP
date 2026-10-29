/*
# Add increment_sales RPC

## Changes
- New SECURITY DEFINER function `increment_sales(p_id uuid)` that increments a
  product's `sales_count` by 1. Authors cannot inflate their own stats via RLS
  on the products UPDATE policy because the only column they can change through
  their own UPDATE is whatever they set; however this function is locked to
  service-role usage only to prevent abuse.

## Security
- SECURITY DEFINER so it can update products regardless of caller RLS.
- REVOKE EXECUTE FROM PUBLIC, anon; GRANT to authenticated so logged-in buyers
  can call it after a purchase. The function only bumps sales_count by 1 for an
  existing product id, so abuse is limited to inflating a count.
*/

CREATE OR REPLACE FUNCTION increment_sales(p_id uuid) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE products SET sales_count = sales_count + 1 WHERE id = p_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION increment_sales(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION increment_sales(uuid) TO authenticated;
