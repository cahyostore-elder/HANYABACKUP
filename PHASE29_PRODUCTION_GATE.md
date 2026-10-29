# FITYORA TOPUP — Phase 29 Production Gate

## Scope
Phase 29 strengthens release verification and makes the remaining go-live work explicit. It adds no runtime dependencies and does not change checkout, payment, authentication, or database behavior.

## Automated verification
- All built-in Node regression tests (`node --test scripts/*.test.mjs`).
- Static release audit (`npm run audit:release`).
- Phase 29 release-gate tests verify environment-template hygiene, migration naming, CI command alignment, public-client secret hygiene, and documentation of operational blockers.
- ZIP integrity is checked before distribution.

## Required external checks — not simulated by static tests
1. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel Preview and Production. Use only a public publishable/anon key in frontend variables; never expose `service_role` or secret keys.
2. Apply the Supabase migrations to the intended project, then run the included read-only preflight SQL and review its results before enabling customer traffic.
3. Deploy a Preview and test on a real phone and desktop with separate customer and staff accounts: sign-up, sign-in/out, catalog search/retry, product selection, target/server validation, order creation, order lookup, admin authorization, and guarded status changes.
4. Verify the configured payment instructions and the real receiving account details out-of-band. A generated order or WhatsApp message is not proof that payment was received.
5. Confirm manual payment review and manual fulfillment procedures with an actual test order. Do not mark an order successful until payment and delivery are independently verified. No live payment gateway or automated game top-up provider is claimed by this package.
6. Check browser console, network failures, responsive layout, keyboard access, and reduced-motion behavior in Preview.
7. Promote only after those checks pass; retain the previous deployment and documented rollback steps.

## Current verification record
- Node regression tests: expected to run without installing npm dependencies.
- Release preflight: expected to run without installing npm dependencies.
- `npm ci`, TypeScript, ESLint, and Vite production build: must be run in an environment with package registry access; not represented as passed by this report.
- Live Supabase, payment receipt, WhatsApp delivery, and fulfillment: require credentials and real external services and are not verified from this offline package build.

## Release decision
**Release candidate for Preview testing — not an unconditional production-ready certification.** The package is prepared for controlled deployment testing; production go-live remains gated on the external checks above.
