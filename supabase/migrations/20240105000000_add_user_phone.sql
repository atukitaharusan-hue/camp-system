-- guest_reservations に電話番号カラムを追加
ALTER TABLE public.guest_reservations
  ADD COLUMN user_phone TEXT;
