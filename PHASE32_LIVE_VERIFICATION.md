# Phase 32 — Live Integration Verification Gate

This phase adds automated source-level regression checks for database RPC permissions, order status transitions, public lookup response shape, migration naming, frontend key hygiene, and release-gate wiring. These checks do not contact Supabase or Vercel. One legacy migration currently has a `.sql.sql` suffix; do not rename an already-applied migration without checking Supabase migration history first.

## Run the local release checks

```bash
npm ci
npm run audit:phase32
node --test scripts/*.test.mjs
npm run audit:release
npm run check
```

## Required live verification before production transactions

1. Deploy to a Vercel Preview deployment with only the Supabase URL and publishable/anon key exposed to the browser. Never expose `service_role` or `sb_secret_...` keys in `VITE_` variables.
2. Apply reviewed migrations to the intended Supabase project in order. Confirm migration history and inspect RLS/policies in the Supabase dashboard.
3. Use a normal customer account to verify login, catalog loading, order creation, order history isolation, and that one customer cannot access another customer's order/profile.
4. Use an admin account to verify role checks, payment verification, allowed status transitions, audit timestamps, and that terminal orders cannot be casually rewritten.
5. Submit once, double-click, refresh, and retry after a simulated network failure. Confirm no unintended duplicate order is created and no ambiguous UI claims success when the RPC fails.
6. Verify payment recipient details directly in the actual banking/e-wallet application. For a test order, confirm amount and reference before staff marks the payment verified. Do not treat a screenshot or a WhatsApp message as payment proof.
7. Verify fulfillment with a test product and confirm customer notification, failed-order handling, and refund/support procedures. Automatic delivery must not be advertised unless the supplier integration is actually configured and tested.
8. Confirm the WhatsApp handoff opens the intended business chat on Android and desktop and includes the correct order code/amount without credentials or sensitive data.
9. Run a final smoke test on the production domain and keep the prior deployment available for rollback.

## Important limitations

Passing these tests is not proof of live integration. Static tests can detect expected code patterns, but cannot confirm deployed RLS behavior, account ownership, real payment arrival, WhatsApp behavior on every device, or supplier fulfillment. Those checks require the real project, accounts, and a controlled test order.
