-- guest_reservations に人数内訳・ペット・車台数カラムを追加
-- 既存の guests カラムは合計人数として残す（後方互換）

ALTER TABLE public.guest_reservations
  ADD COLUMN adults   INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN children INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN infants  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN pets     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN cars     INTEGER NOT NULL DEFAULT 0;

-- RLS: 既存ポリシーで UPDATE を許可していない場合に追加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'guest_reservations' AND policyname = 'Allow anonymous update'
  ) THEN
    CREATE POLICY "Allow anonymous update" ON public.guest_reservations
      FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
END$$;
