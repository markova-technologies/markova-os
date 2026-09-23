-- Migration 022: User Profile Attributes & Re-verification Columns
-- Enhances public.users with personal bio, phone, avatar_url, notification_prefs,
-- and temporary token columns for secure email re-verification workflows.

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMP;

COMMENT ON COLUMN users.avatar_url IS 'Public URL of user profile picture (e.g. Supabase Storage)';
COMMENT ON COLUMN users.notification_prefs IS 'Granular notification channel toggles (calls, security, team)';
COMMENT ON COLUMN users.pending_email IS 'Temporary email staged for re-verification';
