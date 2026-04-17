-- ============================================================
-- アプリケーションデータ用テーブル追加
-- plans, events, app_settings, sales関連, admin_members 等
-- 既存 sites / options テーブルの拡張
-- ============================================================

-- -----------------------------------------------------------
-- 1. sites テーブル拡張
-- -----------------------------------------------------------
ALTER TABLE public.sites ALTER COLUMN campground_id DROP NOT NULL;

ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS site_name TEXT,
  ADD COLUMN IF NOT EXISTS area TEXT,
  ADD COLUMN IF NOT EXISTS sub_area TEXT,
  ADD COLUMN IF NOT EXISTS site_status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS designation_fee DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS feature_note TEXT;

-- 既存の UNIQUE 制約を緩和（campground_id が NULL でも site_number で一意）
ALTER TABLE public.sites DROP CONSTRAINT IF EXISTS sites_campground_id_site_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sites_site_number_unique
  ON public.sites (site_number) WHERE campground_id IS NULL;

-- sites に対する anon アクセスポリシー
CREATE POLICY "Allow anon select sites" ON public.sites FOR SELECT USING (true);
CREATE POLICY "Allow anon insert sites" ON public.sites FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update sites" ON public.sites FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete sites" ON public.sites FOR DELETE USING (true);

-- -----------------------------------------------------------
-- 2. options テーブル拡張
-- -----------------------------------------------------------
ALTER TABLE public.options
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'rental',
  ADD COLUMN IF NOT EXISTS price_type TEXT DEFAULT 'per_unit',
  ADD COLUMN IF NOT EXISTS unit_label TEXT DEFAULT '個',
  ADD COLUMN IF NOT EXISTS max_quantity INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS event_date TEXT,
  ADD COLUMN IF NOT EXISTS duration TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS capacity INTEGER,
  ADD COLUMN IF NOT EXISTS current_participants INTEGER DEFAULT 0;

CREATE POLICY "Allow anon select options" ON public.options FOR SELECT USING (true);
CREATE POLICY "Allow anon insert options" ON public.options FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update options" ON public.options FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete options" ON public.options FOR DELETE USING (true);

-- -----------------------------------------------------------
-- 3. plans テーブル
-- -----------------------------------------------------------
CREATE TABLE public.plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_published BOOLEAN DEFAULT true,
  base_price DECIMAL(10,2) NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 4,
  sales_start_date DATE,
  sales_end_date DATE,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER handle_updated_at_plans
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon select plans" ON public.plans FOR SELECT USING (true);
CREATE POLICY "Allow anon insert plans" ON public.plans FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update plans" ON public.plans FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete plans" ON public.plans FOR DELETE USING (true);

-- -----------------------------------------------------------
-- 4. plan_sites (プラン ↔ サイト 中間テーブル)
-- -----------------------------------------------------------
CREATE TABLE public.plan_sites (
  plan_id UUID REFERENCES public.plans(id) ON DELETE CASCADE NOT NULL,
  site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (plan_id, site_id)
);

ALTER TABLE public.plan_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon select plan_sites" ON public.plan_sites FOR SELECT USING (true);
CREATE POLICY "Allow anon insert plan_sites" ON public.plan_sites FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon delete plan_sites" ON public.plan_sites FOR DELETE USING (true);

-- -----------------------------------------------------------
-- 5. events テーブル
-- -----------------------------------------------------------
CREATE TABLE public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  location TEXT,
  image_url TEXT,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER handle_updated_at_events
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon select events" ON public.events FOR SELECT USING (true);
CREATE POLICY "Allow anon insert events" ON public.events FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update events" ON public.events FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete events" ON public.events FOR DELETE USING (true);

-- -----------------------------------------------------------
-- 6. app_settings (各種設定を JSONB で保持)
-- -----------------------------------------------------------
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER handle_updated_at_app_settings
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon select app_settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Allow anon insert app_settings" ON public.app_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update app_settings" ON public.app_settings FOR UPDATE USING (true) WITH CHECK (true);

-- -----------------------------------------------------------
-- 7. closed_dates (個別休業日)
-- -----------------------------------------------------------
CREATE TABLE public.closed_dates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  closed_date DATE NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.closed_dates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon select closed_dates" ON public.closed_dates FOR SELECT USING (true);
CREATE POLICY "Allow anon insert closed_dates" ON public.closed_dates FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon delete closed_dates" ON public.closed_dates FOR DELETE USING (true);

-- -----------------------------------------------------------
-- 8. closed_date_ranges (期間休業)
-- -----------------------------------------------------------
CREATE TABLE public.closed_date_ranges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.closed_date_ranges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon select closed_date_ranges" ON public.closed_date_ranges FOR SELECT USING (true);
CREATE POLICY "Allow anon insert closed_date_ranges" ON public.closed_date_ranges FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update closed_date_ranges" ON public.closed_date_ranges FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete closed_date_ranges" ON public.closed_date_ranges FOR DELETE USING (true);

-- -----------------------------------------------------------
-- 9. site_closures (サイト個別の閉鎖期間)
-- -----------------------------------------------------------
CREATE TABLE public.site_closures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.site_closures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon select site_closures" ON public.site_closures FOR SELECT USING (true);
CREATE POLICY "Allow anon insert site_closures" ON public.site_closures FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update site_closures" ON public.site_closures FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete site_closures" ON public.site_closures FOR DELETE USING (true);

-- -----------------------------------------------------------
-- 10. admin_members
-- -----------------------------------------------------------
CREATE TABLE public.admin_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  invited_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.admin_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon select admin_members" ON public.admin_members FOR SELECT USING (true);
CREATE POLICY "Allow anon insert admin_members" ON public.admin_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update admin_members" ON public.admin_members FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete admin_members" ON public.admin_members FOR DELETE USING (true);

-- -----------------------------------------------------------
-- 11. admin_invites
-- -----------------------------------------------------------
CREATE TABLE public.admin_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  used_at TIMESTAMPTZ
);

ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon select admin_invites" ON public.admin_invites FOR SELECT USING (true);
CREATE POLICY "Allow anon insert admin_invites" ON public.admin_invites FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update admin_invites" ON public.admin_invites FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete admin_invites" ON public.admin_invites FOR DELETE USING (true);
