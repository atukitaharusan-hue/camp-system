-- ============================================================
-- Remove plaintext admin account password from app_settings
-- ============================================================

update public.app_settings
set value = value - 'password'
where key = 'admin_account'
  and value ? 'password';