# FityoraStore — Admin Catalog Management Update

## Added
- A new **Katalog / Kategori** tab in the admin product manager.
- Create, edit, and delete category/catalog records (`topup_categories`).
- Category deletion checks for existing orders before attempting removal. Categories linked to order history are protected from deletion.
- Package and brand/operator deletion now reports database errors clearly instead of silently refreshing the dashboard.
- Confirmation prompts explain the cascade effects before deleting catalog records.

## Security / data integrity
- Catalog writes still rely on Supabase staff policies (`public.is_admin()` accepting `author` and `admin` roles); no secret key was added to frontend code.
- Historical orders are preserved: foreign-key restrictions may reject deletion of packages or brands referenced by existing orders.
- Category deletion cascades to its brands/packages only when the category has no order history.

## Validation
- Source was inspected and ZIP integrity should be checked after packaging.
- Full TypeScript/lint/build validation could not run in this environment because project dependencies are not installed and npm's offline cache is incomplete. Run `npm ci` and `npm run check` before production deployment.
