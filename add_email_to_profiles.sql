-- ==========================================
-- Add email column to profiles table
-- This enables phone login to work without
-- needing the backend for email lookups.
-- ==========================================

-- 1. Add email column to profiles (if not exists)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Backfill existing profiles with email from auth.users
UPDATE profiles
SET email = au.email
FROM auth.users au
WHERE profiles.id = au.id
  AND profiles.email IS NULL
  AND au.email IS NOT NULL;

-- 3. Allow unauthenticated users to read email by phone_number
-- (needed for phone login lookup from the frontend)
DROP POLICY IF EXISTS "Allow phone lookup for login" ON profiles;
CREATE POLICY "Allow phone lookup for login" ON profiles
  FOR SELECT
  USING (true)
  WITH CHECK (false);
-- Note: This policy allows SELECT but not INSERT/UPDATE/DELETE for anon users.
-- The WITH CHECK (false) prevents writes. Only SELECT is allowed.
