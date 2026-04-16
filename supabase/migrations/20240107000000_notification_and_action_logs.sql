-- ============================================================
-- notification_logs + admin_action_logs テーブル
-- ============================================================

-- notification_logs: 通知記録
CREATE TABLE public.notification_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  reservation_id UUID,
  notification_type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'internal',
  recipient TEXT,
  payload_json JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_notification_logs_reservation ON public.notification_logs(reservation_id);
CREATE INDEX idx_notification_logs_created ON public.notification_logs(created_at DESC);

-- admin_action_logs: 管理者操作ログ
CREATE TABLE public.admin_action_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  admin_email TEXT NOT NULL DEFAULT '',
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  before_json JSONB,
  after_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX idx_admin_action_logs_created ON public.admin_action_logs(created_at DESC);
CREATE INDEX idx_admin_action_logs_target ON public.admin_action_logs(target_type, target_id);

-- RLS
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_action_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_logs_anon_all" ON public.notification_logs
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "admin_action_logs_anon_all" ON public.admin_action_logs
  FOR ALL USING (true) WITH CHECK (true);
