-- Add user profile fields to guest_reservations for the booking form
ALTER TABLE guest_reservations ADD COLUMN IF NOT EXISTS user_gender TEXT;
ALTER TABLE guest_reservations ADD COLUMN IF NOT EXISTS user_occupation TEXT;
ALTER TABLE guest_reservations ADD COLUMN IF NOT EXISTS user_address TEXT;
ALTER TABLE guest_reservations ADD COLUMN IF NOT EXISTS user_referral_source TEXT;
