/*
# FityoraStore — Author role for store owner + staff access

## Overview
1. Drop the auto-promote trigger that forced fityorastoreoffice@gmail.com
   to 'admin'. The owner requested 'author' role instead.
2. Update is_admin() to also accept role = 'author', so authors get the
   same catalog/content management access as admins. The function name
   stays is_admin() (all existing policies reference it) but now means
   "is staff" semantically.
3. Set fityorastoreoffice@gmail.com profile role to 'author'.

## Security
- is_admin() now returns true for role IN ('admin', 'author').
- All existing admin-scoped policies (promo_banners, testimonials, faqs,
  packages, brands, topup_categories, orders SELECT, profiles VIP update)
  automatically grant access to authors via the updated function.
- No new policies needed.
*/

-- Drop the auto-promote trigger + function
DROP TRIGGER IF EXISTS trg_promote_owner ON profiles;
DROP FUNCTION IF EXISTS promote_owner_to_admin();

-- Update is_admin() to accept both 'admin' and 'author' roles
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'author')
  );
$$;
REVOKE EXECUTE ON FUNCTION is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- Set the store owner to 'author'
UPDATE profiles SET role = 'author' WHERE id = '5a9f96d4-fa46-44c8-94af-010f9853fd0e';

SELECT 'author role configured' AS status;
