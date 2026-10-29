# FityoraStore Ultimate No-VIP — Phase 2 Security Audit

## Scope
Baseline: `FityoraStore-Ultimate-NoVIP-Phase1.zip`.
This phase adds audit documentation and read-only Supabase inspection queries. It does not alter the deployed site or run SQL against the live project.

## Confirmed source-level findings

1. **Production state is unverified.** The live URL is discoverable, but this audit could not inspect interactive behavior or authenticate against the site's Supabase project. No claim is made that live ordering/payment flows work.
2. **Migration order matters.** The new workflow migration assumes `public.orders`, `public.is_admin()`, the expected status values, and the relevant columns already exist. Apply only after confirming the deployed schema and migration history.
3. **`is_admin()` implementation needs attention.** The bundled author-role migration defines `is_admin()` as `SECURITY INVOKER` and queries `public.profiles`. Its effective result depends on the profile SELECT policy and grants. Test as a real admin, author, ordinary authenticated user, and anonymous role; do not infer access from the function name alone.
4. **Order visibility must be verified.** The hardening migration adds a staff-read policy; verify that a separate own-order policy still exists so customers can read their own orders but cannot read others' orders.
5. **SECURITY DEFINER RPCs need least privilege.** The bundled `create_topup_order` and `admin_update_order_status` are security-definer functions. Verify owner, `search_path`, execute grants, and authorization checks after all migrations. Never grant service-role credentials to browser code.
6. **Unique payment amounts are not guaranteed forever.** The allocator avoids matching totals for currently `pending`/`processing` orders. It does not reserve a total after an order becomes `success` or `failed`, so late transfers can still be ambiguous. Manual reconciliation should use order code and payment evidence, not amount alone.
7. **Typecheck/build is not yet verified.** Earlier dependency installation timed out and type declarations were missing. This package does not claim a successful production build.

## Recommended execution order

1. Back up the database and confirm current migration history.
2. Run `SUPABASE_SECURITY_READONLY_CHECKS.sql` in the Supabase SQL editor using a privileged read-only inspection session. Queries are SELECT-only and inspect policies, grants, and function definitions.
3. Review results against expected access:
   - anon: no order reads/writes and no protected RPC execution;
   - authenticated customer: can create an order through the RPC and read only their own orders;
   - admin/author: can view/manage catalog and process orders;
   - ordinary customer: cannot modify catalog, profiles' role flags, or order statuses.
4. Apply migrations only in a non-production environment first; run the role matrix and order state-transition tests.
5. Install dependencies in a clean environment; run `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build` separately and retain logs.
6. Deploy to Vercel Preview, test end-to-end with a non-real/test transaction, then decide whether to promote to production.

## Important limitation
This package is an audit-stage deliverable. It does not execute SQL, access production secrets, change Supabase, or deploy to Vercel. Review all query results before making changes.
