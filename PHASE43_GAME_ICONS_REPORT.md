# Phase 43 — Game icon additions

## Scope
Added remote square icon candidates for the three catalog brands already present in the Phase 39 catalog migration:
- Call of Duty Mobile (`call-of-duty-mobile`)
- FC Mobile (`fc-mobile`)
- Honor of Kings (`honor-of-kings`)

Registered all three slugs in `APP_ICON_SLUGS`, so `BrandLogo` renders them as square `object-cover` app icons like the other games. Existing candidate fallback behavior remains in place if an image host fails.

## Files changed
- `src/lib/brandAssets.ts`

## Validation
- Static check confirmed all three slugs have configured assets and are registered as app icons.
- No dependency changes.
- Full Vite build was not run in this environment because project dependencies are not installed and network access is unavailable.

## Deployment note
This updates source code only. It does not change the currently deployed Vercel site automatically. Publish the updated project through the normal Vercel deployment workflow to make the icons appear on the live site. No Supabase SQL change is needed for this icon-only change.
