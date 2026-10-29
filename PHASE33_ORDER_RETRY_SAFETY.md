# Phase 33 — Safe Checkout Retries (Idempotency)

## What changed

A request key now accompanies each checkout attempt. The browser retains that key if a request errors or times out and reuses it only while the checkout payload remains the same, including across a refresh in the same tab/session. Only the idempotency UUID and a hash of the payload are stored in `sessionStorage`; the target ID/phone itself is not persisted there. Once the server confirms the order and returns the official total, the stored key is cleared. The database serializes requests with the same user/key pair, returns the original order on a matching retry, and rejects reuse of the same key for different order details. This helps prevent duplicate orders when the database committed an order but the browser did not receive the response.

The frontend also now refuses to show an order as created unless the database returns a valid order code and a positive authoritative `total_amount`. It no longer falls back to the estimate when that value is absent.

## Important rollout order

**Apply this migration before deploying the updated frontend.** The RPC signature changes from six arguments to seven (`p_request_id uuid`). If the frontend is deployed before the migration, checkout calls will fail until the migration is applied.

1. Back up the Supabase database and confirm the target project/environment.
2. Review `supabase/migrations/20261027000000_order_creation_idempotency.sql`.
3. Apply it through the project's normal Supabase migration workflow; do not manually rename prior migrations.
4. Confirm the new `orders.client_request_id` column and unique partial index exist, and that `create_topup_order` grants execute only to `authenticated`.
5. Deploy the updated frontend to Vercel Preview and test a controlled test order.
6. Submit an order once, then test retry behavior by simulating a lost response. Verify that the same key returns one order code and does not add a second row.
7. Try reusing a key for different order details in a non-production test and confirm the RPC rejects it.
8. Verify that the customer pays the exact returned `total_amount`; do not pay the pre-checkout estimate.
9. Only after all checks pass, promote the Preview build. Keep the previous deployment available for rollback.

## Manual validation still required

Automated source tests do not connect to Supabase, execute migrations, or validate real banking transactions. Test RLS and permissions using customer and staff accounts. Do not treat this idempotency change as a payment gateway: payment verification and top-up fulfillment remain manual unless separate provider integrations are configured and independently tested.

## Rollback considerations

Do not simply remove `client_request_id` after orders have been created with it. If rollback is needed, first stop checkout traffic or revert the frontend, assess the migration history and new order data, and prepare a reviewed forward migration. Avoid deleting production order records or editing applied migration files.
