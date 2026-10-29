# Phase 39 — Catalog Import

## What changed
- Added a Supabase migration to import all 86 supplied telecom/PLN package codes (Axis, Indosat, Telkomsel, Tri, Smartfren, XL, PLN). The XL 10,000 code is retained exactly as supplied: `PTLXS10`.
- Added game brands and all denomination names from `FITYORA-DAFTAR-GROUP-ITEM-GLORY-VOUCHER.json`. Existing brand/package entries are preserved; matching package names are not duplicated.
- Added `packages.provider_code` for supplier codes.
- New imports are set to price `0` intentionally because the supplied HTML did not include verified live prices.
- Storefront blocks selection of zero-priced packages and labels them “Harga belum diatur” so the site cannot place a free/incorrectly priced order.

## Required before sale
1. Deploy the updated source to Vercel.
2. Apply `supabase/migrations/20261027020000_phase39_catalog_import.sql` in Supabase SQL Editor / migration workflow.
3. In admin, set and verify the selling price for every package. Existing package rows retain their prior prices.
4. Verify supplier availability and fulfillment method before accepting real orders. `provider_code` records source codes; it does not itself connect a supplier API.

## Source limitations
The submitted Glory Voucher HTML exposes package names/codes and dynamically requests prices from its own server. It does not establish prices for FITYORA. No prices or automated supplier integration are invented here.
