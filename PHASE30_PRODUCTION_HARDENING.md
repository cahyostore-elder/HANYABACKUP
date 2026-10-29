# FITYORA TOPUP — Phase 30 Production Hardening

## What changed
- Adds a repeatable production hygiene check for manifest/lockfile identity, required public Supabase environment variables, `.gitignore` protection, Vercel SPA routing, CI alignment, migration filename conventions, and obvious server-secret markers in frontend source.
- Registers the check as `npm run audit:phase30` and includes it in `npm run audit:release`.
- Adds regression tests and this operational release runbook. No runtime dependency was added and no checkout/payment/database business logic was intentionally changed.

## Local validation
Run from the project directory:

```sh
npm ci
npm run check
node --test scripts/*.test.mjs
npm run audit:phase30
npm run audit:release
```

The production check is a static hygiene check. It cannot prove that credentials are correct, that remote policies are applied, or that payment and fulfillment work against live services.

## Required Preview release gates
1. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel Preview and Production. Only a public publishable/anon key belongs in browser-visible variables. Never use a service-role or secret key in `VITE_*` variables.
2. Apply reviewed Supabase migrations (SQL files) to the intended project and inspect the read-only preflight output. Confirm RLS and RPC permissions using separate customer and staff test accounts.
3. Deploy a Vercel Preview. Test signup/login/logout, catalog loading and retry, product/target validation, order creation, order lookup, admin authorization, and allowed/blocked order status transitions on mobile and desktop.
4. Independently verify the receiving account and payment instructions. A generated order, screenshot, or WhatsApp message does not prove payment was received.
5. Test the manual payment-review and fulfillment workflow with a controlled test order. Do not mark orders complete until receipt and delivery have been independently checked. This source does not claim an integrated live payment gateway or automatic supplier fulfillment.
6. Inspect browser console and network errors, responsive behavior, keyboard navigation, and reduced-motion behavior.
7. Keep the previous Vercel deployment available. If critical errors occur, roll back to the previous deployment and pause new order intake until the cause is understood.

## Release status
**Preview candidate only until the live gates above are completed.** Static checks can pass while environment configuration, remote Supabase policies, payment receipt, WhatsApp delivery, or fulfillment are still broken. Do not interpret a green static check as a production certification.
