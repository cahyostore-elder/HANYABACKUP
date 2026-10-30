# Phase 59 — Database Policy and Index Hardening

This migration removes confirmed duplicate public-read policies, separates staff write policies into INSERT/UPDATE/DELETE actions, combines order/profile SELECT access into one policy per table, pins `generate_order_code()` search_path, drops duplicate/unused indexes, adds missing foreign-key indexes, and revokes browser execution on obsolete admin RPCs.

## Preserved behavior
- Public catalog read policies remain available to anon and authenticated users.
- Author/Admin keep catalog CRUD permissions through `public.is_admin()`.
- Members can read only their own profile and orders; Author/Admin can read all profiles/orders.
- Supplier cost and pricing audit tables remain inaccessible directly from browser roles and are accessed only through guarded RPCs. Restrictive deny-all policies add defense in depth if a permissive policy is accidentally introduced later.
- No products, sale prices, supplier costs, orders, profiles, or settings are updated by this migration.

## Remaining manual/security review
- `lookup_order(code)` remains a public SECURITY DEFINER endpoint because guest order tracking depends on it. It needs a separate rate-limit/abuse review and should not expose additional columns.
- Several active RPCs still require SECURITY DEFINER to write orders or protected tables; each must retain its explicit `auth.uid()` ownership or `public.is_admin()` guard.
- Enable leaked-password protection in Supabase Auth settings; that control is not changed by SQL migrations.
- Remote migration history must be baselined before any automated push. Current database did not have `supabase_migrations.schema_migrations` during audit.