# FITYORA TOPUP Phase 40 — Roblox Pricing & Deployment Preparation

## Phase 40 changes
- Added migration `supabase/migrations/20261027030000_phase40_roblox_user_pricing.sql`.
- Imported the 11 Roblox Robux prices supplied by the store owner. The migration updates matching package rows and inserts missing rows without duplicating a matching brand/name.
- No provider codes are fabricated for Roblox; supplier fulfilment/API is not configured by this migration.
- Registered `npm run audit:phase40` and added it to `npm run audit:release`.
- Updated the manifest to include the 11 user-priced Roblox packages.

## Before applying to Supabase
1. Make a database backup or use a staging project first.
2. Confirm migrations through Phase 39 have been applied in order. Phase 40 assumes the `brands`, `topup_categories`, and `packages` tables exist.
3. Open Supabase Dashboard → SQL Editor and run `supabase/migrations/20261027030000_phase40_roblox_user_pricing.sql`, or apply it with the project's established migration workflow.
4. Verify `brands.slug = 'roblox'` and all 11 package prices using a read-only query:

```sql
SELECT b.name AS brand, p.name AS package, p.price, p.provider_code
FROM public.packages p
JOIN public.brands b ON b.id = p.brand_id
WHERE b.slug = 'roblox'
ORDER BY p.sort_order, p.name;
```

Expected prices: 50=9500; 100=18500; 200=37000; 300=55500; 400=74000; 500=92500; 1000=185000; 1500=277500; 2000=370000; 2500=462500; 5000=904000 (IDR).

## Vercel setup
1. Push the extracted project to a private Git repository or import the project using your existing Vercel workflow.
2. In Vercel Project Settings → Build & Development, use Framework Preset `Vite`, Build Command `npm run build`, Output Directory `dist`.
3. Add these Environment Variables to Production, Preview, and Development as appropriate:
   - `VITE_SUPABASE_URL` — URL from Supabase Project Settings → API.
   - `VITE_SUPABASE_PUBLISHABLE_KEY` — public/publishable key from Supabase.
4. Do not add `service_role` or any secret key to a `VITE_` variable or browser bundle.
5. Deploy Preview first. Verify login/signup, public catalog, admin permissions, manual payment proof flow, order status, and checkout. Promote to Production only after these pass.

## Current limitations
- This package cannot deploy to the user's Vercel project or modify the live Supabase project without authorized project access. The migration is prepared but is **not applied** by creating this ZIP.
- A successful local/static test is not proof of a production build or live payment. Run `npm ci && npm run check && npm run audit:release` in an environment with Node.js 20.19+ or 22.12+ and npm registry access.
- Manual payment still requires staff verification. Roblox prices were provided by the user; product availability, taxes/fees, and supplier fulfillment must be checked before taking real orders.
