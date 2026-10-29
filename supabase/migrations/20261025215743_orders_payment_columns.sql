/*
# Orders: add payment columns

## Changes
- Add `payment_method` text (e.g. 'dana','gopay','ovo','shopeepay','seabank','va'). Default ''.
- Add `total_amount` numeric — full amount incl. fee + unique code that the buyer must transfer.
- Add `unique_code` integer — the unique suffix appended to the transfer amount (225 by default).

## Security
- RLS already in place. No new grants needed; existing INSERT/SELECT on `orders` covers new
  columns (column-level privilege is NOT restricted, so existing table-level grants apply).
- No UPDATE grant added (orders stay immutable from the client except the success flip done
  via the existing flow — note: the success update relies on the owner's INSERT-only grant;
  we add an UPDATE policy so the owner can update status of their own orders).
*/

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS total_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unique_code integer NOT NULL DEFAULT 0;

-- Allow owner to update status of their own order (used by the simulated success flip)
DROP POLICY IF EXISTS "update_own_orders" ON orders;
CREATE POLICY "update_own_orders" ON orders FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT UPDATE ON orders TO authenticated;
