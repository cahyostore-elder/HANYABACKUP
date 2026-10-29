# Phase 31 — Commerce Safety and Live-Launch Checklist

Phase 31 adds regression checks around the highest-risk storefront paths. It does not replace a live test against the actual Supabase project or payment accounts.

## Automated checks

Run after installing the exact lockfile dependencies:

```bash
npm ci
node --test scripts/phase31-commerce-safety.test.mjs
node --test scripts/*.test.mjs
npm run audit:release
```

The Phase 31 tests inspect source-level invariants: authenticated checkout, duplicate-submit locking, database-owned order creation, unique payment-method IDs, maintenance-method rejection, the configured WhatsApp destination, order-code validation, and migration hardening markers.

## Required before accepting real orders

1. **Environment:** Set the real `VITE_SUPABASE_URL` and public publishable/anon key in Vercel Preview first. Never place a Supabase `service_role` key or `sb_secret_...` key in any `VITE_` variable or frontend file.
2. **Database:** Apply migrations to the intended Supabase project in order. Confirm RLS is enabled and test with a normal customer account, not only an administrator. Verify a customer cannot read or change another customer's order/profile.
3. **Checkout:** Create one low-value test order. Verify the database-computed package price, fee, unique code, payment method, and order code match the UI. Double-click/retry and confirm only one order is created.
4. **Payment details:** Verify each recipient/account number against the owner's current official account before publishing. Do not assume configured payment methods are connected to an automated gateway. The current storefront flow should be treated as manual payment review unless a real provider integration is configured and independently tested.
5. **Payment review:** Do not mark an order paid from a screenshot alone. Verify the incoming transaction in the recipient's actual banking/e-wallet app, including amount, reference, and recipient account.
6. **Fulfillment:** Test the complete admin status flow with a test order. Record who fulfills it, how failures/refunds are handled, and how the customer is informed. Do not promise automatic top-up delivery unless the supplier API and its failure handling are live.
7. **WhatsApp:** Confirm the link opens the intended business chat on Android and desktop, and that the message contains the correct order code and amount. Do not include credentials or private account data in prefilled messages.
8. **Release:** Deploy a Preview, run the tests above, then test the production domain. Keep the previous deployment available for rollback.

## Scope and limitations

A passing source test only confirms that expected code patterns are present. It does not prove that remote RLS policies are correct, the actual account details are valid, a payment has arrived, WhatsApp opens on every device, or a supplier fulfills an order. Those require authenticated live tests and owner verification.
