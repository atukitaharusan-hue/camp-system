-- ============================================================
-- guest_reservations テーブル
-- 認証不要のゲスト予約用（テストモデル）
-- 既存の reservations テーブル（FK制約あり）とは分離
-- 将来的に本番スキーマへ統合可能な構造
-- ============================================================

CREATE TABLE public.guest_reservations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- ユーザー情報（認証なし）
  user_identifier TEXT,                         -- LINE ID など将来用
  user_name TEXT NOT NULL DEFAULT '未設定',
  user_email TEXT,

  -- 宿泊情報
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  nights INTEGER NOT NULL DEFAULT 1,
  guests INTEGER NOT NULL DEFAULT 1,

  -- サイト情報（非正規化）
  site_number TEXT,
  site_name TEXT,
  site_type site_type DEFAULT 'standard',
  campground_name TEXT DEFAULT '森のキャンプ場 Green Valley',

  -- 金額
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,

  -- ステータス
  status reservation_status DEFAULT 'pending',
  payment_method payment_method,
  payment_status payment_status DEFAULT 'pending',

  -- QR
  qr_token TEXT UNIQUE NOT NULL,

  -- オプション（JSON）
  options_json JSONB DEFAULT '[]'::jsonb,

  -- 同意
  agreed_cancellation BOOLEAN DEFAULT false,
  agreed_terms BOOLEAN DEFAULT false,
  agreed_sns BOOLEAN DEFAULT false,

  -- その他
  special_requests TEXT,
  checked_in_at TIMESTAMP WITH TIME ZONE,

  -- タイムスタンプ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

  CHECK (check_out_date > check_in_date),
  CHECK (guests > 0)
);

-- インデックス
CREATE INDEX idx_guest_reservations_qr_token ON public.guest_reservations(qr_token);
CREATE INDEX idx_guest_reservations_status ON public.guest_reservations(status);
CREATE INDEX idx_guest_reservations_dates ON public.guest_reservations(check_in_date, check_out_date);

-- updated_at トリガー
CREATE TRIGGER handle_updated_at_guest_reservations
  BEFORE UPDATE ON public.guest_reservations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS（テストモデルでは全許可）
ALTER TABLE public.guest_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous insert" ON public.guest_reservations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous select" ON public.guest_reservations
  FOR SELECT USING (true);
