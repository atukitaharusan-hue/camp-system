-- plans テーブルに category / features カラムを追加
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS features TEXT;

COMMENT ON COLUMN public.plans.category IS 'プランカテゴリ（例: 閑散期限定, ファミリー向け, スタンダード）';
COMMENT ON COLUMN public.plans.features IS 'プランの特徴テキスト（例: オートサイト / 電源あり / 最大6名）';
