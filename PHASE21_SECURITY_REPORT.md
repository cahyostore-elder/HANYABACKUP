# Phase 21 — Order Lookup RPC Search-Path Hardening

## Migration
`supabase/migrations/20261026040000_lookup_order_search_path_hardening.sql`

The migration redefines `public.lookup_order(text)` with an explicit `search_path = pg_catalog, public` and schema-qualifies application table references. It preserves the existing return shape and leaves the customer-facing order-status lookup available to `anon` and `authenticated`, because the public order-status page supports customers who are not signed in. Execute grants are explicitly revoked and re-granted to those intended roles.

## Important access note
The order code acts like a lookup credential: anyone who knows a valid code can request the fields returned by the lookup function. Keep order codes private; do not post screenshots containing them publicly. A future design could bind lookup to an authenticated user or require a second verification factor, but that would change the public customer flow.

## Verification
- 4 focused Phase 21 static migration tests passed.
- Combined project tests at Phase 21: 99 passed, 0 failed.
- Static SQL inspection only. PostgreSQL did not execute this migration in this environment and the migration has not been applied to the live Supabase project.

## Apply safely
Review and back up the database, then apply migrations through the project's normal Supabase migration workflow. Do not assume the live database has applied this migration until its migration history and function definition are checked in Supabase.
