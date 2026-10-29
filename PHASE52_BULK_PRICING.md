# Phase 52 — Supplier Cost & Bulk Pricing

## Features
- Track supplier seller price separately in the admin-only `package_supplier_costs` table; supplier costs are not exposed by the public package catalogue. Existing selling prices are not changed by the migration.
- Select multiple products and preview a fixed nominal adjustment before applying. The default is exactly Rp10, as requested.
- Export catalog to CSV compatible with Excel. Import CSV requires the stable package `id` and a valid `price`; `supplier_cost` is optional. Save Excel workbooks as CSV UTF-8 before importing.
- Validate row IDs and prices, skip invalid rows, request explicit confirmation, and show/download a per-row success/failure report.
- Writes remain protected by existing `public.is_admin()` RLS policies on `packages`. The UI role check is not the security boundary.

## Apply migration
Run `supabase/migrations/20261028010000_phase52_supplier_cost_and_bulk_pricing.sql` in the Supabase SQL Editor for the same project used by this deployment. It adds an admin-only supplier cost table and guarded RPC; it does not rewrite existing selling prices.

## CSV schema
`id,brand,package_name,supplier_cost,price`

Use the export generated from the current catalog as the starting template. Keep `id` unchanged; duplicate or unknown IDs are rejected. Blank `supplier_cost` means preserve the existing cost. `price` is the customer-facing selling price.

## Checks
- `npm run audit:phase52`
- `npm run check`
- In admin, select one test package, set adjustment to 10, inspect preview, cancel and verify no DB change. Repeat and confirm, then verify exactly Rp10 was added.
- Export CSV; change one test row's price and supplier cost; import, inspect preview, cancel, then repeat and confirm.
- Test invalid price, unknown ID, duplicate ID, and non-admin session. Confirm invalid rows are reported and RLS rejects unauthorized writes.
- Supplier cost 0 means “not entered yet”; margin displayed for those rows is not meaningful until cost is populated. The supplier-cost table is protected by RLS and only admins can read or write it.

## Scope note
CSV is supported directly and can be opened/edited in Excel or Google Sheets. Native `.xlsx` binary workbooks are not parsed by this implementation.
