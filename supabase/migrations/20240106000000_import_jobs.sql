-- ============================================================
-- 取込履歴テーブル
-- スプレッドシート取込の実行ログと行ごとの結果を記録
-- ============================================================

-- import_jobs: 取込ジョブ1回分
CREATE TABLE public.import_jobs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  executed_by TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT '',
  total_rows INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- import_job_rows: 各行の処理結果
CREATE TABLE public.import_job_rows (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  import_job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  raw_data_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  created_reservation_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- インデックス
CREATE INDEX idx_import_jobs_created_at ON public.import_jobs(created_at DESC);
CREATE INDEX idx_import_job_rows_job_id ON public.import_job_rows(import_job_id);

-- RLS（管理画面からのみ利用、anon キーで操作）
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_job_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_jobs_anon_select" ON public.import_jobs
  FOR SELECT USING (true);

CREATE POLICY "import_jobs_anon_insert" ON public.import_jobs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "import_jobs_anon_update" ON public.import_jobs
  FOR UPDATE USING (true);

CREATE POLICY "import_job_rows_anon_select" ON public.import_job_rows
  FOR SELECT USING (true);

CREATE POLICY "import_job_rows_anon_insert" ON public.import_job_rows
  FOR INSERT WITH CHECK (true);
